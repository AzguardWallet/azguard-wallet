<script setup>
/** Vendor */
import { onBeforeMount, onMounted, onUnmounted } from "vue"

/** Components */
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { managers } from "@/utils/core"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const params = new URLSearchParams(window.location.search)
const requestId = params.get('requestId')
// if (!appStore.isLogined) {
// 	appStore.pageAwaitingAuth = encodeURIComponent(`${window.location.pathname}${window.location.hash}?${(new URLSearchParams(window.location.search)).toString()}`)

// 	router.push({
// 		path: "/popup/auth",
// 	})
// }

const isLoading = ref(false)
const isActionCalled = ref(false)

const selectedAccounts = ref([])

const interactionRequest = ref()
const dapp = ref()

const chains = ref()
const requiredChains = ref([])
const methods = ref()
const events = ref()

const profile = computed(() => appStore.profile)
const networks = computed(() => appStore.networks)
const accounts = ref([])

async function fetchAccounts() {
	if (accounts.value.length) return

	const uniqueNetworks = Array.from(
		new Map(networks.value.map((n) => [n.chainId, n])).values()
	)

	const results = await Promise.all(
		uniqueNetworks.map(async (network) => {
			const accountClient = new AccountServiceClient(profile.value, network)
			const accounts = await accountClient.getAccounts(true)
			return [...accounts]
		})
	)
	
	accounts.value = results.flat()

	if (requiredChains.value.length) {
		const chainsOrder = requiredChains.value.map(ch => ch.split(":").pop())
		
		const chainIdPriority = chainsOrder.reduce((acc, chainId, index) => {
			acc[chainId] = index
			return acc
		}, {})

		accounts.value.sort((a, b) => {
			const priorityA = chainIdPriority[a.chainId] ?? 99
			const priorityB = chainIdPriority[b.chainId] ?? 99

			if (priorityA !== priorityB) {
				return priorityA - priorityB
			}

			if (a.chainId !== b.chainId) {
				return a.chainId - b.chainId
			}

			return a.index - b.index
		})
	}
	
	if (appStore.account) {
		selectedAccounts.value.push({ ...appStore.account })
	}
}

const validationResult = ref()
const isProposalExpired = ref(false)

const processingError = ref({
	show: false,
	title: "",
	tooltip: "",
	type: "",
})
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

const validateProposal = async () => {
	if (!accounts.value.length) return

	try {
		validationResult.value = await walletConnectServiceClient.validateProposal(
			interactionRequest.value.payload,
			new Map(accounts.value.map(acc => [acc.chainId, acc.address]))
		)

		const values = Object.values(validationResult.value)
		chains.value = values.flatMap(v => v.chains)
		methods.value = values.flatMap(v => v.methods)
		events.value = values.flatMap(v => v.events)
	} catch(error) {
		const values = [
			...Object.values(interactionRequest.value.payload.params.requiredNamespaces),
			...Object.values(interactionRequest.value.payload.params.optionalNamespaces)
		].reduce((acc, curr) => {
			acc.chains = Array.from(new Set([...acc.chains, ...curr.chains]))
			acc.methods = Array.from(new Set([...acc.methods, ...curr.methods]))
			acc.events = Array.from(new Set([...acc.events, ...curr.events]))

			return acc
		}, {
			chains: [],
			methods: [],
			events: []
		})
		chains.value = values.chains
		methods.value = values.methods
		events.value = values.events
		
		fillError("Proposal validation error.", error)
	}
}

const init = async () => {
	try {
		interactionRequest.value = await managers.interaction.getInteractionRequest(requestId)
		requiredChains.value = Object.values(interactionRequest.value.payload.params.requiredNamespaces).flatMap(n => n.chains)
		dapp.value = interactionRequest.value.payload.params.proposer.metadata
	} catch (error) {
		fillError("Proposal pre-processing error.", error)
	}
}

const handleAccountSelect = (account) => {
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

function checkSelectedAccounts() {
	const requiredNetwroks = requiredChains.value.map(ch => Number(ch.split(":").pop()))
	const selectedAccountsNetworks = Array.from(
		new Set(selectedAccounts.value.map(acc => acc.chainId))
	)

	return requiredNetwroks.every(ch => selectedAccountsNetworks.includes(ch))
}

const handleProposalExpiredEvent = (payload) => {
	if (interactionRequest.value?.payload?.id === payload.id) {
		isProposalExpired.value = true
	}
}
const walletConnectServiceClient = new WalletConnectServiceClient(undefined, undefined, handleProposalExpiredEvent)

const handleApprove = async () => {
	if (!checkSelectedAccounts()) {
		fillError("Pre-processing error.", `You must select at least one account for each required network: ${requiredChains.value.join(", ")}`, "warning")

		return
	}

	isLoading.value = true
	isActionCalled.value = true
	try {
		const uniqueChains = Array.from(new Set(selectedAccounts.value.map(acc => acc.chainId)))
		await walletConnectServiceClient.approveDappSession(interactionRequest.value.payload, profile.value.id, uniqueChains, selectedAccounts.value)
		closeWindow()
	} catch (error) {
		isLoading.value = false
		fillError("Unexpected proposal processing error.", error)
	}
}

const handleReject = async () => {
	isActionCalled.value = true

	walletConnectServiceClient.rejectDappSession(interactionRequest.value.payload)
	closeWindow()
}

const closeWindow = () => {
	chrome.windows.getCurrent((currentWindow) => {
		chrome.windows.remove(currentWindow.id, () => {})
	})
}

const handleWindowClose = () => {
	managers.interaction.deleteInteractionRequest(requestId)

	if (!isActionCalled.value && !isProposalExpired.value) {
		handleReject()
	}
}

watch(
	() => [appStore.networks, appStore.profile],
	async () => {
		if (appStore.networks && appStore.profile) {
			if (!accounts.value.length) {
				await fetchAccounts()
			}
			if (!validationResult.value) {
				await validateProposal()
			}
		}
	},
)

watch(
	() => appStore.account,
	() => {
		if (appStore.account && !selectedAccounts.value.length) {
			selectedAccounts.value.push(appStore.account)
		}
	}
)

onBeforeMount(async () => {
	if (!appStore.isLogined) {
		setTimeout(() => {
			appStore.pageAwaitingAuth = encodeURIComponent(`${window.location.pathname}${window.location.hash}?${(new URLSearchParams(window.location.search)).toString()}`)
			router.push({
				path: "/popup/auth",
			});
		}, 500);
	}
})

onMounted( async () => {
	await init()
	
	if (appStore.networks?.length && appStore.profile?.id) {
		await fetchAccounts()
		await validateProposal()
	}

	window.addEventListener("beforeunload", handleWindowClose)
})

onUnmounted(() => {
	window.removeEventListener("beforeunload", handleWindowClose);
})
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="14">
			<Flex align="center" justify="center" gap="8" :style="{paddingTop: '8px'}">
				<Text size="16" weight="600" color="primary">Connection proposal</Text>
			</Flex>
			<Flex align="center" justify="center" gap="20">
				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="$style.avatar"
				>
					<img v-if="dapp?.icons[0]" width="48" height="48" :src="dapp?.icons[0]" />

					<Icon
						v-else
						name="dapp"
						size="48"
						color="blue"
					/>

					<Text size="13" weight="600" color="primary"> {{ dapp?.name }} </Text>
				</Flex>

				<Flex align="center" gap="12" :class="isLoading && $style.status_icon" :style="{paddingBottom: '13px'}">
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="$style.avatar"
				>
					<img width="48" height="48" src="@/assets/logo.png" />

					<Text size="13" weight="600" color="primary">Azguard Wallet</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{marginTop: '-4px'}">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
					<Text size="13" color="primary">would like to connect to your wallet</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">This site is requesting access to view your addresses.</Text>
					<Text size="12" color="secondary">Always make sure you trust the sites you interact with.</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="4">
				<Text size="15" weight="600" color="primary">Proposal parameters:</Text>

				<Flex align="center" gap="4">
					<Text size="13" color="secondary">Networks:</Text>
					<Text size="13" color="secondary"> {{ chains?.join(', ') }} </Text>
				</Flex>
				
				<Flex align="center" gap="4">
					<Text size="13" color="secondary">Methods:</Text>
					<Text size="13" color="secondary"> {{ methods?.join(', ') }} </Text>
				</Flex>

				<Flex align="center" gap="4">
					<Text size="13" color="secondary">Events:</Text>
					<Text size="13" color="secondary"> {{ events?.join(', ') }} </Text>
				</Flex>
			</Flex>

			<Flex v-if="accounts.length" direction="column" align="start" justify="start" gap="12" :class="$style.accounts_section">
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="15" weight="600" color="primary">Select accounts</Text>
					<Text size="13" color="secondary">to be connected to the dApp</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex v-for="acc in accounts" @click="handleAccountSelect(acc)" gap="10" :class="[$style.account, (isLoading || (processingError.show && processingError.type === 'error')) && $style.disabled]">
						<Flex align="center">
							<Icon v-if="selectedAccounts?.find(a => a.address === acc.address)" name="check-circle" size="16" color="green" />
							<Icon v-else name="circle" size="16" color="secondary" />
						</Flex>				

						<Flex direction="column" gap="4" wide>
							<Flex align="center" justify="between" gap="12">
								<Text size="14" weight="600" color="primary">
									{{ acc.name }}
								</Text>

								<Tooltip v-if="networks.length > 1">
									<NetworkBadge :chainId="acc.chainId" />

									<template #content>
										<Text size="13" color="secondary">
											{{ `aztec:${acc.chainId}` }}
										</Text>
									</template>
								</Tooltip>
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
					<Text size="12" weight="600" color="secondary" :style="{paddingLeft: '4px'}">
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
				<Button
					@click="handleReject"
					wide
					type="secondary"
					size="medium"
					:disabled="isLoading"
				>
					<Text size="13">Reject</Text>
				</Button>

				<Button
					@click="handleApprove"
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

		<Flex
			v-if="isProposalExpired"
			align="center"
			justify="center"
			:class="$style.proposal_expired_overlay"
		>
			<Flex direction="column" align="center" gap="16" :class="$style.proposal_expired_content">
				<Text size="13" weight="600" color="primary">This connection proposal is expired</Text>

				<Button
					@click="closeWindow"
					type="primary"
					size="small"
					:style="{width: '50%'}"
				>
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
	background-color: var(--card-bg);
	padding: 12px;
	border-radius: 8px;
	text-align: center;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	z-index: 1001;
}
</style>
