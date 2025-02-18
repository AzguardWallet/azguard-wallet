<script setup>
/** Vendor */
import { computed, onMounted, onUnmounted } from "vue"

/** Components */
import FeeJuiceCard from "../../components/modules/send/FeeJuiceCard.vue"
import JsonViewer from "@/components/ui/JsonViewer/JsonViewer.vue"

/** Services */
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { ExecutionServiceClient, OperationKind } from "@/wallet/services/execution/client"
import { DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

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
				case OperationKind.AddNote:
				case OperationKind.GetCompleteAddress:
				case OperationKind.SendTransaction:
				case OperationKind.SimulateTransaction:
				case OperationKind.SimulateUnconstrained: {
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
	try {
		isLoading.value = true
		const results = await executionService.executeOperations(
			operations.value,
			session.value.dappMetadata.name ?? "Unknown dapp",
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
				v-if="accounts?.length"
				direction="column"
				align="start"
				justify="start"
				gap="8"
				:class="$style.section"
			>
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="14" weight="600" color="primary">Account{{ accounts.length > 1 ? "s" : "" }}</Text>
				</Flex>
				<Flex v-for="account in accounts" :key="account.address" gap="10" :class="$style.account">
					<Flex align="center">
						<Icon name="check-circle" size="16" color="green" />
					</Flex>

					<Flex direction="column" gap="4">
						<Text size="14" weight="600" color="primary">
							{{ account.name }}
						</Text>
						<Text size="13" weight="600" color="tertiary">
							{{ `${account.address.slice(0, 6)}...${account.address.slice(-4)}` }}
						</Text>
					</Flex>
				</Flex>
			</Flex>

			<Flex v-if="payload?.params.operations?.length" direction="column" align="start" justify="start" gap="8">
				<Flex justify="between">
					<Text size="14" weight="600" color="primary">Requested operations:</Text>
				</Flex>

				<Flex align="start" direction="column" justify="start" gap="12" :class="$style.json_viewer">
					<JsonViewer :data="payload.params.operations" :requestId="requestId" />
				</Flex>
			</Flex>

			<FeeJuiceCard />
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
					<Text size="13" color="inverse">Confirm</Text>
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
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 10px 24px 12px 24px;
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
