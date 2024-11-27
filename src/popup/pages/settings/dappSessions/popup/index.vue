<script setup>
/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Utils */
import { managers } from "@/utils/core"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const route = useRoute()
const router = useRouter()

// const params = ref()
// const requestId = ref()
// params.value = new URLSearchParams(window.location.search)
// requestId.value = params.value.get('requestId')

const params = new URLSearchParams(window.location.search)
const requestId = params.get('requestId')
// console.log('route asd', route);


// if (!appStore.isLogined) {	
// 	const redirect = `${window.location.pathname}${window.location.hash}?${params.toString()}`

// 	console.log('!appStore.isLogined', route, redirect);	
	
// 	router.push({
// 		path: "/popup/auth",
// 		query: { redirect },
// 	})
// }

const isLoading = ref(false)
const isActionCalled = ref(false)

// const profile = await managers.profile.getActiveProfile()
// const networks = await managers.network.getNetworks()
// const accountServiceClient = new AccountServiceClient(profile, networks[1])
// const accounts = await accountServiceClient.getAccounts()

const selectedAccounts = ref([])

const interactionRequest = ref()
const dapp = ref()
const chains = ref()
const accounts = computed(() => appStore.accounts)
const isProposalExpired = ref(false)

const validationError = ref({
	show: false,
	title: "",
})

const validateProposal = async () => {
	try {
		await walletConnectServiceClient.validateProposal(interactionRequest.value.payload, appStore.account.address)
	} catch(error) {
		validationError.value = {
			show: true,
			title: "Proposal validation error. Failed to connect to this dApp."
		}
	}
}

const init = async () => {
	try {
		interactionRequest.value = await managers.interaction.getInteractionRequest(requestId)
		dapp.value = interactionRequest.value.payload.params.proposer.metadata
		chains.value = Object.values(interactionRequest.value.payload.params.requiredNamespaces)
			.flatMap(namespace => namespace.chains)
	} catch (error) {
		console.log('err', error);
	}
}

const handleAccountSelect = (account) => {
	if (!selectedAccounts.value.includes(account)) {
		selectedAccounts.value.push(account)
	} else {
		selectedAccounts.value = selectedAccounts.value.filter(acc => acc !== account)
	}
}

const handleApprove = async () => {
	isLoading.value = true
	isActionCalled.value = true

	const dappSession = await walletConnectServiceClient.approveDappSession(interactionRequest.value.payload, selectedAccounts.value)
	appStore.dappSessions.push(dappSession)

	isLoading.value = false
	closeWindow()
}

const handleReject = async () => {
	isActionCalled.value = true

	await walletConnectServiceClient.rejectDappSession(interactionRequest.value.payload)
	closeWindow()
}

const handleProposalExpiredEvent = (payload) => {
	if (interactionRequest.value?.payload?.id === payload.id) {
		isProposalExpired.value = true
	}
}
const walletConnectServiceClient = new WalletConnectServiceClient(undefined, undefined, handleProposalExpiredEvent)

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
	() => appStore.account,
	async () => {
		if (appStore.account) {
			selectedAccounts.value.push(appStore.account)
			await validateProposal()
		}
	}
)

onMounted( async () => {
	await init()
	if (appStore.account) selectedAccounts.value.push(appStore.account)

	window.addEventListener("beforeunload", handleWindowClose)
})

onUnmounted(() => {
	window.removeEventListener("beforeunload", handleWindowClose);
})
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="20">
			<Flex align="center" justify="center" gap="8" :style="{paddingTop: '8px'}">
				<Text size="16" weight="600" color="primary">Connection proposal</Text>
			</Flex>
			<Flex align="center" justify="center" gap="20">
				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="[$style.wallet, $style.connected]"
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

				<Flex align="center" gap="12" :class="allConnected && $style.ready_icon" :style="{paddingBottom: '13px'}">
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="[$style.wallet, $style.connected]"
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
					<Text size="12" color="secondary">This site is requesting access to view your account address.</Text>
					<Text size="12" color="secondary">Always make sure you trust the sites you interact with.</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="4">
				<Text size="15" weight="600" color="primary">Proposal networks:</Text>
				<Text v-for="c in chains" size="13" color="primary"> {{ c }} </Text>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="10" :class="$style.accounts_section">
				<Flex direction="column" align="start" justify="start" gap="6">
					<Text size="15" weight="600" color="primary">Select accounts</Text>
					<Text size="13" color="secondary">to be connected to the dApp</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex v-for="acc in accounts" @click="handleAccountSelect(acc)" gap="10" :class="$style.account">
						<Flex align="center">
							<Icon v-if="selectedAccounts.includes(acc)" name="check-circle" size="16" color="green" />
							<Icon v-else name="circle" size="16" color="secondary" />
						</Flex>				

						<Flex direction="column" gap="4">
							<Text size="14" weight="600" color="primary">
								{{ acc.name }}
							</Text>
							<Text size="13" weight="600" color="tertiary">
								$0.00
								<Text color="support">•</Text>
								{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="6">
			<Flex align="center" justify="start" wide>
				<Text v-if="validationError.show" size="12" color="red" :style="{paddingLeft: '4px'}">
					{{ validationError.title }}
				</Text>
			</Flex>
			
			<Flex align="center" justify="between" gap="12">
				<Button
					@click="handleReject"
					wide
					type="secondary"
					size="medium"
				>
					<Text size="13">Reject</Text>
				</Button>

				<Button
					@click="handleApprove"
					wide
					type="primary"
					size="medium"
					:disabled="!selectedAccounts.length || validationError.show"
				>
					<Text size="13" color="white">Approve</Text>
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
					wide
					type="primary"
					size="medium"
				>
					<Text size="13" color="white">OK</Text>
				</Button>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.wallet {
	position: relative;

	width: 80px;
	height: 80px;

	border-radius: 12px;
	background: var(--op-8);

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

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 180px;
	overflow-y: auto;

	scrollbar-width: thin;
}

.account {
	width: 100%;
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.proposal_expired_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.4); /* Полупрозрачный тёмный фон */
	z-index: 1000; /* Поверх основного контента */
}

.proposal_expired_content {
	background-color: white;
	padding: 20px;
	border-radius: 8px;
	text-align: center;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	z-index: 1001;
}
</style>
