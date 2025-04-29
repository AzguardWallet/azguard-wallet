<script setup>
/** Vendor */
import { computed, onMounted, onUnmounted } from "vue"

/** Components */
import FeeSettingsCard from "../../components/modules/send/FeeSettingsCard.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { trimAddress } from "@/utils/string"

/** Services */
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { AccountServiceClient } from "@/wallet/services/account/client"
import {
	ActionKind,
	CustomPaymentMethod,
	ExecutionServiceClient,
	FeeSettings,
	OperationKind,
} from "@/wallet/services/execution/client"
import { DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"
import { TxOrigin, OriginType } from "@/wallet/services/transaction/client"

/** Store */
import { useAppStore } from "@/stores/app.store"

const appStore = useAppStore()
const profile = computed(() => appStore.profile)

const router = useRouter()

const requestId = ref()
const payload = ref()

const session = ref()
const operations = ref([])
const accounts = ref([])

const isLoading = ref(false)
const isInteractionCancelled = ref(false)
const processingError = ref({
	show: false,
	title: "",
	tooltip: "",
})

function fillError(title, tooltip) {
	if (!title) {
		processingError.value = {
			show: false,
			title: "",
			tooltip: "",
		}

		return
	}

	processingError.value = {
		show: true,
		title,
		tooltip,
	}
}

const init = async () => {
	try {
		requestId.value = router.currentRoute.value.query.requestId
		payload.value = await interactionService.getInteractionPayload(requestId.value)
		if (profile.value.id !== payload.value.session.profileId) {
			// TODO: redirect to sign in page with preconfigured profile id
			throw new Error("Sign in with another profile")
		}
		const networkClient = new NetworkServiceClient()
		const _accounts = []
		const _operations = []
		for (const op of payload.value.params.operations) {
			switch (op.kind) {
				case OperationKind.RegisterContract:
				case OperationKind.RegisterSender: {
					const [_, chainId] = op.chain.split(":")
					const networks = await networkClient.getNetworks(+chainId)
					if (networks.length === 0) {
						throw new Error("Network no longer exist")
					}
					const network = networks.find(x => x.isDefault) || networks[0]
					_operations.push({
						...op,
						network,
						networkId: network.id,
					})
					break
				}
				case OperationKind.GetCompleteAddress:
				case OperationKind.SendTransaction:
				case OperationKind.SimulateTransaction:
				case OperationKind.SimulateUtility:
				case OperationKind.SimulateViews: {
					const [_, chainId, address] = op.account.split(":")
					const networks = await networkClient.getNetworks(+chainId)
					if (networks.length === 0) {
						throw new Error("Network no longer exist")
					}
					const network = networks.find(x => x.isDefault) || networks[0]
					const account = await new AccountServiceClient(profile.value, network).getAccount(address)
					if (!account) {
						throw new Error("Account no longer exist")
					}
					_operations.push({
						...op,
						network,
						networkId: network.id,
						account,
						accountAddress: account.address,
					})
					if (!_accounts.find(x => x.address === account.address)) {
						_accounts.push(account)
					}
					break
				}
				default: {
					throw new Error("Invalid operation kind")
				}
			}
		}
		for (const op of _operations.filter(x => x.kind === OperationKind.SendTransaction)) {
			op.feeSettings = op.setup ? new FeeSettings(new CustomPaymentMethod()) : undefined
		}
		session.value = payload.value.session
		operations.value = _operations
		accounts.value = _accounts
	} catch (error) {
		console.error(error)
		fillError("Something went wrong")
	}
}

const onActiveProfileChanged = profile => {
	if (!profile) {
		reject()
	}
}

const onInteractionCancelled = _requestId => {
	if (requestId.value === _requestId) {
		isInteractionCancelled.value = true
	}
}

const approve = async () => {
	if (operations.value.find(x => x.kind === OperationKind.SendTransaction && !x.feeSettings)) {
		fillError(
			"Validation error",
			"You must specify fee payment method for each 'Send transaction' operations",
			"warning",
		)
		return
	}
	try {
		isLoading.value = true
		const results = await executionService.executeOperations(
			operations.value,
			new TxOrigin(OriginType.DAPP, session.value.dappMetadata.name ?? "Unknown dapp")
		)
		interactionService.resolveInteraction(requestId.value, results)
		closeWindow(true)
	} catch (error) {
		fillError("Processing error.", error)
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	interactionService.rejectInteraction(requestId.value, "User rejected")
	closeWindow(true)
}

const closeWindow = interactionCompleted => {
	if (interactionCompleted) {
		window.removeEventListener("beforeunload", reject)
	}
	chrome.windows.getCurrent(window => {
		chrome.windows.remove(window.id)
	})
}

const profileService = new ProfileServiceClient(
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	onActiveProfileChanged,
)
const interactionService = new DappInteractionServiceClient(undefined, undefined, onInteractionCancelled)
const executionService = new ExecutionServiceClient()

onBeforeMount(async () => {
	if (!appStore.isLogined) {
		setTimeout(() => {
			appStore.pageAwaitingAuth = router.currentRoute.value.fullPath
			router.push({
				path: "/popup/auth",
			})
		}, 100)
	}
})

onMounted(async () => {
	await init()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	window.removeEventListener("beforeunload", reject)
})

const humanize = str => {
	return `${str[0].toUpperCase()}${str.substring(1)}`.replace("_", " ")
}

const showJson = () => {
	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/json"))
	url.searchParams.set("requestId", requestId.value)
	chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 900 })
}
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="14">
			<Flex align="center" justify="center" gap="8" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">Operation request</Text>
			</Flex>

			<Flex align="center" justify="center" gap="20">
				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<img v-if="session?.dappMetadata.logo" width="48" height="48" :src="session?.dappMetadata.logo" />

					<Icon v-else name="dapp" size="48" color="blue" />

					<Text size="13" weight="600" color="primary">
						{{ session?.dappMetadata.name ?? "Unknown dapp" }}
					</Text>
				</Flex>

				<Flex
					align="center"
					gap="12"
					:class="[$style.status_icon, isLoading && $style.processing]"
					:style="{ paddingBottom: '13px' }"
				>
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<img width="48" height="48" src="@/assets/logo.png" />

					<Text size="13" weight="600" color="primary">Azguard Wallet</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{ marginTop: '-4px' }">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary"> {{ session?.dappMetadata.url }} </Text>
					<Text size="13" color="primary">The dapp wants you to execute operation(s)</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">Make sure you trust the site you interact with</Text>
				</Flex>
			</Flex>

			<Flex
				v-if="operations?.length"
				direction="column"
				align="start"
				justify="start"
				gap="8"
				style="padding-bottom: 8px"
			>
				<Flex wide justify="between">
					<Text size="14" weight="600" color="primary">Requested operations:</Text>
					<Icon @click="showJson" name="expand" size="16" color="tertiary" :class="$style.fullscreen_icon" />
				</Flex>

				<template v-for="(op, i) in operations" :key="i">
					<Flex v-if="op.kind === OperationKind.SendTransaction" direction="column" wide>
						<Flex
							:class="$style.operation"
							direction="column"
							wide
							style="
								margin-bottom: 0;
								border-bottom-right-radius: 0;
								border-bottom-left-radius: 0;
								border-bottom: none;
							"
						>
							<Flex wide justify="between">
								<Text size="14" color="primary">{{ humanize(op.kind) }}</Text>
								<NetworkBadge :chainId="op.network.chainId" />
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">From account:</Text>
								<Text size="12" color="primary">
									{{ op.account.name }}
									<Text color="secondary">({{ trimAddress(op.account.address) }})</Text>
								</Text>
							</Flex>
							<Flex v-if="op.setup?.length" :class="$style.prop">
								<Text size="12" color="secondary">Fee payload:</Text>
								<Flex direction="column" gap="4">
									<Text v-for="(action, j) in op.setup" :key="`${i}:${j}`" size="12" color="primary">
										<template
											v-if="
												action.kind === ActionKind.Call ||
												action.kind === ActionKind.EncodedCall
											"
										>
											<Text color="secondary"> call </Text>
											{{ action.method || action.selector }}
											<Text color="secondary"> in </Text>
											{{ trimAddress(action.contract || action.to) }}
										</template>
										<template v-else>
											{{ action.kind.replace("_", " ") }}
										</template>
									</Text>
								</Flex>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(action, j) in op.actions"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<template
											v-if="
												action.kind === ActionKind.Call ||
												action.kind === ActionKind.EncodedCall
											"
										>
											<Text color="secondary"> call </Text>
											{{ action.method || action.selector }}
											<Text color="secondary"> in </Text>
											{{ trimAddress(action.contract || action.to) }}
										</template>
										<template v-else>
											{{ action.kind.replace("_", " ") }}
										</template>
									</Text>
								</Flex>
							</Flex>
						</Flex>
						<FeeSettingsCard
							:profile="profile"
							:network="op.network"
							:account="op.account"
							:modelValue="op.feeSettings"
							@update:modelValue="
								$event => {
									op.feeSettings = $event
									fillError()
								}
							"
							style="border-top-left-radius: 0; border-top-right-radius: 0; opacity: 1"
						/>
					</Flex>
					<Flex v-else :class="$style.operation" direction="column" wide>
						<Flex wide justify="between">
							<Text size="14" color="primary">{{ humanize(op.kind) }}</Text>
							<NetworkBadge :chainId="op.network.chainId" />
						</Flex>
						<template v-if="op.kind === OperationKind.GetCompleteAddress">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Requested account:</Text>
								<Text size="12" color="primary">
									{{ op.account.name }}
									<Text color="secondary">({{ trimAddress(op.account.address) }})</Text>
								</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === OperationKind.RegisterContract">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<Text size="12" color="primary">{{ trimAddress(op.address) }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === OperationKind.RegisterSender">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Sender address:</Text>
								<Text size="12" color="primary">{{ trimAddress(op.address) }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === OperationKind.SimulateTransaction">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">From account:</Text>
								<Text size="12" color="primary">
									{{ op.account.name }}
									<Text color="secondary">({{ trimAddress(op.account.address) }})</Text>
								</Text>
							</Flex>
							<Flex v-if="op.setup?.length" :class="$style.prop">
								<Text size="12" color="secondary">Fee payload:</Text>
								<Flex direction="column" gap="4">
									<Text v-for="(action, j) in op.setup" :key="`${i}:${j}`" size="12" color="primary">
										<template
											v-if="
												action.kind === ActionKind.Call ||
												action.kind === ActionKind.EncodedCall
											"
										>
											<Text color="secondary"> call </Text>
											{{ action.method || action.selector }}
											<Text color="secondary"> in </Text>
											{{ trimAddress(action.contract || action.to) }}
										</template>
										<template v-else>
											{{ action.kind.replace("_", " ") }}
										</template>
									</Text>
								</Flex>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(action, j) in op.actions"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<template
											v-if="
												action.kind === ActionKind.Call ||
												action.kind === ActionKind.EncodedCall
											"
										>
											<Text color="secondary"> call </Text>
											{{ action.method || action.selector }}
											<Text color="secondary"> in </Text>
											{{ trimAddress(action.contract || action.to) }}
										</template>
										<template v-else>
											{{ action.kind.replace("_", " ") }}
										</template>
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === OperationKind.SimulateUtility">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">From account:</Text>
								<Text size="12" color="primary">
									{{ op.account.name }}
									<Text color="secondary">({{ trimAddress(op.account.address) }})</Text>
								</Text>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<Text size="12" color="primary">{{ trimAddress(op.contract) }}</Text>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Function:</Text>
								<Text size="12" color="primary">{{ op.method }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === OperationKind.SimulateViews">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">From account:</Text>
								<Text size="12" color="primary">
									{{ op.account.name }}
									<Text color="secondary">({{ trimAddress(op.account.address) }})</Text>
								</Text>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">View calls:</Text>
								<Flex direction="column" gap="4">
									<Text v-for="(call, j) in op.calls" :key="`${i}:${j}`" size="12" color="primary">
										{{ call.method || call.selector }}
										<Text color="secondary"> in </Text>
										{{ trimAddress(call.contract || call.to) }}
									</Text>
								</Flex>
							</Flex>
						</template>
					</Flex>
				</template>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10">
			<Tooltip v-if="processingError.show" side="top" position="start" :disabled="!processingError.tooltip">
				<Flex align="center" wide>
					<Icon name="info" size="14" :color="processingError.type === 'warning' ? 'orange' : 'red'" />
					<Text size="12" weight="600" color="secondary" :style="{ paddingLeft: '4px' }">
						{{ processingError.title }}
					</Text>
				</Flex>

				<template #content>
					<Text size="12" color="secondary">
						{{ processingError.tooltip }}
					</Text>
				</template>
			</Tooltip>

			<Flex align="center" justify="between" gap="12">
				<Button @click="reject" wide type="secondary" size="medium" :disabled="isLoading">
					<Text size="13">Reject</Text>
				</Button>

				<Button
					@click="approve"
					wide
					type="primary"
					size="medium"
					:loading="isLoading"
					:disabled="processingError.show"
				>
					<Text size="13" color="inverse"> {{ `${isLoading ? 'Executing' : 'Confirm'}` }} </Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isInteractionCancelled" align="center" justify="center" :class="$style.request_expired_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.request_expired_content">
				<Text size="13" weight="600" color="primary">The operation request was cancelled</Text>

				<Button @click="closeWindow" type="primary" size="small" :style="{ width: '50%' }">
					<Text size="13" color="inverse">OK</Text>
				</Button>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	overflow: auto;
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 12px;
}

& img {
	border-radius: 50%;
	transition: all 0.2s ease;
}

.avatar {
	position: relative;

	width: 80px;
	height: 80px;

	border-radius: 12px;
	background: var(--card-bg);

	text-align: center;
	white-space: nowrap;

	& img {
		border-radius: 50%;
		transition: all 0.2s ease;
	}

	& .icon_connectors {
		position: absolute;
		top: -12px;
		right: -12px;
		box-sizing: content-box;

		background: #101010;
		border-radius: 50%;

		padding: 3px;
	}
}

@keyframes loading {
	0% {
		opacity: 1;
	}

	25% {
		opacity: 0.8;
	}

	50% {
		opacity: 0.4;
	}

	70% {
		opacity: 0.8;
	}

	100% {
		opacity: 1;
	}
}

.status_icon {
	& svg {
		transition: all 0.5s ease;
	}

	& svg:first-child {
		fill: var(--green);

		transform: translateX(16px);

		filter: drop-shadow(0 0px 8px var(--green));
	}

	& svg:last-child {
		fill: var(--green);

		transform: translateX(-16px);

		filter: drop-shadow(0 0px 8px var(--green));
	}
}

.processing {
	animation: loading 2s infinite linear;
}

.section {
	width: 100%;
}

.operation {
	width: 100%;
	border-radius: 12px;
	border: 1px solid var(--gray-10);

	padding: 12px;
}

.prop {
	width: 100%;
	justify-content: space-between;
	padding-top: 12px;

	:last-child {
		text-align: right;
	}
}

.fullscreen_icon {
	cursor: pointer;
	&:hover {
		background: var(--op-10);
	}
}

.account {
	width: 100%;
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);
}

.networks {
	width: 100%;
	max-height: 170px;
	overflow: auto;
}

.network {
	width: 100%;
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.json_viewer {
	width: 100%;
	height: 180px;
	max-height: 180px;

	box-shadow: 0 0 0 1px var(--gray-5);
	border-radius: 8px;
}

.disabled {
	cursor: default;
	pointer-events: none;
}

.request_expired_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.4);
	z-index: 1000;
}

.request_expired_content {
	background-color: var(--card-bg);
	padding: 12px;
	border-radius: 8px;
	text-align: center;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	z-index: 1001;
}
</style>
