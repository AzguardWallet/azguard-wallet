<script setup>
/** Vendor */
import { onBeforeMount, onMounted, onUnmounted } from "vue"

/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { getChainName } from "@/components/ui/utils.js"
import { AccessLevel, confirmationPolicies } from "@/utils/confirmation-policies"

/** Services */
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"
import { DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

/** Store */
import { useAppStore } from "@/stores/app.store"

const appStore = useAppStore()
const profile = computed(() => appStore.profile)
const networks = computed(() => appStore.networks)

const router = useRouter()

const requestId = ref()
const payload = ref()
const dapp = ref({})
const permissions = ref([])

const accounts = ref([])
const selectedAccounts = ref([])
const selectedConfirmationPolicy = ref(confirmationPolicies.at(-1))

const isLoading = ref(false)
const isInteractionCancelled = ref(false)
const processingError = ref({
	show: false,
	title: "",
	tooltip: "",
	type: "",
})

const initRequest = async () => {
	try {
		requestId.value = router.currentRoute.value.query.requestId
		payload.value = await interactionService.getInteractionPayload(requestId.value)
		dapp.value = payload.value.params.dappMetadata
		permissions.value = unpackPermissions(
			payload.value.params.requiredPermissions ?? [],
			payload.value.params.optionalPermissions ?? [],
		)
	} catch (error) {
		console.error(error)
		fillError("Something went wrong")
	}
}

const initAccounts = async () => {
	const res = []
	if (profile.value && networks.value && permissions.value) {
		const set = new Set()
		for (const p of permissions.value) {
			for (const chain of p.chains) {
				const chainId = +chain.split(":")[1]
				if (set.has(chainId)) {
					continue
				}
				set.add(chainId)
				const network = networks.value.find(x => x.chainId === chainId)
				if (network) {
					const accountClient = new AccountServiceClient()
					const _accounts = await accountClient.getAccounts(profile.value.id, network.chainId, true)
					res.push(..._accounts.toSorted((a, b) => a.index - b.index))
				}
			}
		}
	}
	accounts.value = res
}

function fillError(title, tooltip, type) {
	if (!title) {
		processingError.value = {
			show: false,
			title: "",
			tooltip: "",
			type: "",
		}
		return
	}
	processingError.value = {
		show: true,
		title,
		tooltip,
		type: type ? type : "error",
	}
}

const selectConfirmationPolicy = policy => {
	selectedConfirmationPolicy.value = policy
}

const selectAccount = account => {
	if (processingError.value.show && processingError.value.type === "warning") {
		fillError()
	}
	const index = selectedAccounts.value.findIndex(acc => acc.address === account.address)
	if (index < 0) {
		selectedAccounts.value.push(account)
	} else {
		selectedAccounts.value.splice(index, 1)
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

const checkSelectedAccounts = () => {
	const requiredChains = [
		...new Set(permissions.value.filter(x => x.required).flatMap(x => x.chains.map(x => +x.split(":")[1]))),
	]
	const selectedChains = [...new Set(selectedAccounts.value.map(acc => acc.chainId))]
	return requiredChains.every(x => selectedChains.includes(x))
}

const approve = async () => {
	if (!checkSelectedAccounts()) {
		fillError(
			"Validation error",
			"You must select at least one account for each network in the required permissions",
			"warning",
		)
		return
	}
	try {
		isLoading.value = true
		const session = await sessionService.addDappSession(
			dapp.value,
			packPermissions(permissions.value.filter(x => x.selected)),
			selectedAccounts.value.map(acc => `aztec:${acc.chainId}:${acc.address}`),
			selectedConfirmationPolicy.value?.confirmationLevel ?? AccessLevel.None,
		)
		const sessionInfo = {
			id: session.id,
			permissions: session.permissions,
			accounts: session.accounts,
		}
		await interactionService.resolveInteraction(requestId.value, sessionInfo)
		closeWindow(true)
	} catch (error) {
		console.error(error)
		fillError("Something went wrong")
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

const profileService = new ProfileServiceClient()
profileService.onActiveProfileChanged.add(onActiveProfileChanged)

const sessionService = new DappSessionServiceClient()

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

watch(
	() => [appStore.profile, appStore.networks],
	async () => {
		await initAccounts()
	},
)

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
	profileService.connect()
	sessionService.connect()
	interactionService.connect()
	await initRequest()
	await initAccounts()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	profileService.disconnect()
	sessionService.disconnect()
	interactionService.disconnect()
	window.removeEventListener("beforeunload", reject)
})

const unpackPermissions = (required, optional) => {
	const result = new Map()
	for (const p of required) {
		if (!p.chains?.length) {
			continue
		}
		if (p.methods?.length) {
			for (const method of p.methods) {
				const key = `r:m:${method}`
				if (!result.has(key)) {
					result.set(key, {
						method,
						chains: new Set(p.chains),
						required: true,
						selected: true,
						type: 0,
					})
				} else {
					for (const chain of p.chains) {
						result.get(key).chains.add(chain)
					}
				}
			}
		}
		if (p.events?.length) {
			for (const event of p.events) {
				const key = `r:e:${event}`
				if (!result.has(key)) {
					result.set(key, {
						event,
						chains: new Set(p.chains),
						required: true,
						selected: true,
						type: 1,
					})
				} else {
					for (const chain of p.chains) {
						result.get(key).chains.add(chain)
					}
				}
			}
		}
	}
	for (const p of optional) {
		if (!p.chains?.length) {
			continue
		}
		if (p.methods?.length) {
			for (const method of p.methods) {
				for (const chain of p.chains) {
					if (result.get(`r:m:${method}`)?.chains.has(chain)) {
						continue
					}
					const key = `o:m:${method}`
					if (!result.has(key)) {
						result.set(key, {
							method,
							chains: new Set([chain]),
							required: false,
							selected: true,
							type: 0,
						})
					} else {
						result.get(key).chains.add(chain)
					}
				}
			}
		}
		if (p.events?.length) {
			for (const event of p.events) {
				for (const chain of p.chains) {
					if (result.get(`r:e:${event}`)?.chains.has(chain)) {
						continue
					}
					const key = `o:e:${event}`
					if (!result.has(key)) {
						result.set(key, {
							event,
							chains: new Set([chain]),
							required: false,
							selected: true,
							type: 1,
						})
					} else {
						result.get(key).chains.add(chain)
					}
				}
			}
		}
	}
	return [...result.values()]
		.map(x => ({ ...x, chains: [...x.chains] }))
		.toSorted((a, b) => {
			if (a.required !== b.required) {
				return a.required ? -1 : 1
			}
			if (a.type !== b.type) {
				return a.type - b.type
			}
			return (a.method ?? a.event).localeCompare(b.method ?? b.event)
		})
}

const packPermissions = permissions => {
	const groups = new Map()
	permissions.forEach(x => {
		const key = x.chains.toSorted((a, b) => a.localeCompare(b)).join(",")
		let arr = groups.get(key)
		if (arr === undefined) {
			arr = []
			groups.set(key, arr)
		}
		arr.push(x)
	})
	return [...groups.values()].map(g => ({
		chains: g[0].chains,
		methods: g.filter(p => !!p.method).map(p => p.method),
		events: g.filter(p => !!p.event).map(p => p.event),
	}))
}
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="16">
			<Flex align="center" justify="center" gap="8" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">Connection request</Text>
			</Flex>
			<Flex align="center" justify="center" gap="20">
				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<img v-if="dapp?.icon" width="48" height="48" :src="dapp?.icon" />

					<Icon v-else name="dapp" size="48" color="blue" />

					<Text size="13" weight="600" color="primary"> {{ dapp?.name ?? "Unknown DApp" }} </Text>
				</Flex>

				<Flex
					align="center"
					gap="12"
					:class="isLoading && $style.status_icon"
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
					<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
					<Text size="13" color="primary">The dapp wants to connect to your wallet</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">Make sure you trust the site you interact with</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="4">
				<Text size="15" weight="600" color="primary">Permissions:</Text>
				<Flex v-for="p in permissions" align="center" gap="4">
					<Icon name="check-circle" :color="p.required ? 'green' : 'sand'" size="11" />
					<Text size="13" color="secondary">
						{{ p.method ?? p.event }} on
						{{ p.chains.map(c => getChainName(+c.split(":")[1]).toLowerCase()).join(", ") }}
					</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="4">
				<Text size="15" weight="600" color="primary">Confirmation policy</Text>
				<Dropdown style="width: 100%">
					<template #trigger>
						<Flex align="center" gap="8" class="clickable" :class="$style.account">
							<Text size="13" color="secondary" style="flex: 1; line-height: 1.2">
								{{ selectedConfirmationPolicy.description }}
							</Text>
							<Icon name="chevron" size="12" color="secondary" />
						</Flex>
					</template>

					<template #popup>
						<DropdownItem
							v-for="policy in confirmationPolicies"
							:key="policy.level"
							@click="selectConfirmationPolicy(policy)"
						>
							<Flex align="center" gap="8">
								<Text
									size="13"
									weight="600"
									color="primary"
									style="max-width: 290px; white-space: normal; line-height: 1.2"
								>
									{{ policy.title }}
								</Text>
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex
				v-if="accounts.length"
				direction="column"
				align="start"
				justify="start"
				gap="12"
				:class="$style.accounts_section"
			>
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="15" weight="600" color="primary">Select accounts</Text>
					<Text size="13" color="secondary">to allow interaction with</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex
						v-for="acc in accounts"
						@click="selectAccount(acc)"
						gap="10"
						:class="[
							$style.account,
							(isLoading || (processingError.show && processingError.type === 'error')) &&
								$style.disabled,
						]"
					>
						<Flex align="center">
							<Icon
								v-if="selectedAccounts?.find(a => a.address === acc.address)"
								name="check-circle"
								size="16"
								color="green"
							/>
							<Icon v-else name="circle" size="16" color="secondary" />
						</Flex>

						<Flex direction="column" gap="4" wide>
							<Flex align="center" justify="between" gap="12">
								<Text size="14" weight="600" color="primary">
									{{ acc.name }}
								</Text>

								<NetworkBadge :chainId="acc.chainId" />
							</Flex>
							<Text size="13" weight="600" color="tertiary">
								{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10">
			<Tooltip v-if="processingError.show" side="top" position="start" wide :disabled="!processingError.tooltip">
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
					:disabled="!selectedAccounts.length || processingError.show"
				>
					<Text size="13" color="inverse">Approve</Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isInteractionCancelled" align="center" justify="center" :class="$style.proposal_expired_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.proposal_expired_content">
				<Text size="13" weight="600" color="primary">Connection request was cancelled</Text>

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
		/* filter: grayscale(1);
		opacity: 0.5; */

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
		transition: all 1s ease;
		animation: loading 2s infinite linear;
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

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 172px;
	overflow: auto;

	/* scrollbar-width: thin; */
}

.account {
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

.disabled {
	cursor: default;
	pointer-events: none;
}

.proposal_expired_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.4);
	z-index: 1000;
}

.proposal_expired_content {
	width: 90%;
	background-color: var(--card-bg);
	padding: 12px;
	border-radius: 8px;
	text-align: center;
	line-height: 1.2;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	z-index: 1001;
}
</style>
