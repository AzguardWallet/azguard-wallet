<script setup>
/** Vendor */
import { computed, onMounted, onUnmounted } from "vue"

/** Components */
import FeeJuiceCard from "../../components/modules/send/FeeJuiceCard.vue"
import JsonViewer from "@/components/ui/JsonViewer/JsonViewer.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { managers } from "@/utils/core"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const router = useRouter()
const params = new URLSearchParams(window.location.search)
const requestId = params.get('requestId')
// if (!appStore.isLogined) {
// 	appStore.pageAwaitingAuth = encodeURIComponent(`${window.location.pathname}${window.location.hash}?${(new URLSearchParams(window.location.search)).toString()}`)
// 	router.push({
// 		path: "/popup/auth",
// 	});
// }

const isLoading = ref(false)
const isActionCalled = ref(false)

const interactionRequest = ref()
const payload = ref()
const dappSession = ref()
const selectedNetwork = computed(() => cacheStore.selectedNetwork)
const networks = ref([])
const account = ref()
const isRequestExpired = ref(false)

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
		interactionRequest.value = await managers.interaction.getInteractionRequest(requestId)
		payload.value = interactionRequest.value?.payload

		if (!payload.value) {
			fillError("Failed to load operation payload. Try sending request again.")
			return
		}

		dappSession.value = await managers.interaction.getDappSession({topic: payload.value.topic})
		if (!dappSession.value) {
			fillError("No active session found. Try reconnecting dApp.")
			return
		}

		account.value = dappSession.value?.accounts.find(acc => acc.address === payload.value.params?.request?.account)
		if (!account.value) {
			fillError("Requested account not found. Try reconnecting dApp.")
			return
		}

		const chainId = payload.value.params.chainId?.split(':')?.pop()
		networks.value = await managers.network.getNetworks(Number(chainId))
		if (!networks.value.length) {
			fillError(`Not supported network ${payload.value.params.chainId}.`)
			return
		}

		cacheStore.selectedNetwork = networks.value[0]
		cacheStore.proposedNetworks = networks.value
	} catch (error) {
		fillError("Operation pre-processing error.", error)
	}
}

const handleNetworkSelect = () => {
	popupStore.open("select_network")
}

const handleConfirm = async () => {
	isLoading.value = true
	isActionCalled.value = true

	try {
		const txHash = await walletConnectServiceClient.confirmRequest(selectedNetwork.value?.id, account.value?.address, dappSession.value?.name, interactionRequest.value.payload)

		closeWindow()
	} catch (error) {
		isLoading.value = false
		fillError("Processing error.", error)
	}
}

const handleReject = async () => {
	isActionCalled.value = true

	walletConnectServiceClient.rejectRequest(interactionRequest.value.payload)
	closeWindow()
}

const handleRequestExpiredEvent = (payload) => {
	if (interactionRequest.value?.payload?.id === payload.id) {
		isRequestExpired.value = true
	}
}
const walletConnectServiceClient = new WalletConnectServiceClient(undefined, undefined, undefined, handleRequestExpiredEvent)

const closeWindow = () => {
	chrome.windows.getCurrent((currentWindow) => {
		chrome.windows.remove(currentWindow.id, () => {})
	})
}

const handleWindowClose = () => {
	managers.interaction.deleteInteractionRequest(requestId)

	if (!isActionCalled.value && !isRequestExpired.value) {
		handleReject()
	}
}

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

	window.addEventListener("beforeunload", handleWindowClose)
})

onUnmounted(() => {
	window.removeEventListener("beforeunload", handleWindowClose);
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="14">
			<Flex align="center" justify="center" gap="8" :style="{paddingTop: '8px'}">
				<Text size="16" weight="600" color="primary">Confirm operation</Text>
			</Flex>

			<Flex align="center" justify="center" gap="20">
				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="$style.avatar"
				>
					<img v-if="dappSession?.icon" width="48" height="48" :src="dappSession?.icon" />

					<Icon
						v-else
						name="dapp"
						size="48"
						color="blue"
					/>

					<Text size="13" weight="600" color="primary"> {{ dappSession?.name }} </Text>
				</Flex>

				<Flex align="center" gap="12" :class="[$style.status_icon, isLoading && $style.processing]" :style="{paddingBottom: '13px'}">
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

			<Flex direction="column" align="center" justify="center" gap="4" :style="{marginTop: '-4px'}">
					<Text size="13" weight="600" color="primary"> {{ dappSession?.url }} </Text>
					<Text size="13" color="secondary">requests operation to you</Text>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="8" :class="$style.section">
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="14" weight="600" color="primary">Account</Text>
					<!-- <Text size="13" color="secondary">to execute the operation</Text> -->
				</Flex>
				<Flex gap="10" :class="$style.account">
					<Flex align="center">
						<Icon name="check-circle" size="16" color="green" />
					</Flex>				

					<Flex direction="column" gap="4">
						<Text size="14" weight="600" color="primary">
							{{ account?.name }}
						</Text>
						<Text size="13" weight="600" color="tertiary">
							{{ `${account?.address.slice(0, 6)}...${account?.address.slice(-4)}` }}
						</Text>
					</Flex>
				</Flex>
			</Flex>

			<Flex v-if="networks.length" direction="column" align="start" justify="start" gap="8" :class="$style.section">
				<Flex align="end" justify="start" gap="4">
					<Text size="14" weight="600" color="primary">Select netwrok</Text>
					<Text size="13" color="secondary">to execute the operation</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="[$style.networks, (isLoading || processingError.show) && $style.disabled]">
					<Flex @click="handleNetworkSelect()" gap="10" :class="$style.network">
						<Flex align="center">
							<Icon name="check-circle" size="16" color="green" />
						</Flex>				

						<Flex direction="column" gap="4">
							<Flex align="center" gap="10">
								<Text size="14" weight="600" color="primary">
									{{ selectedNetwork.name }}
								</Text>

								<NetworkBadge :chainId="selectedNetwork.chainId" />
							</Flex>
							<Text size="13" weight="600" color="tertiary">
								{{ selectedNetwork.rpcUrl }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>

			<Flex v-if="payload?.params" direction="column" align="start" justify="start" gap="8">
				<Flex justify="between">
					<Text size="14" weight="600" color="primary">Request parameters:</Text>
				</Flex>

				<Flex align="start" direction="column" justify="start" gap="12" :class="$style.json_viewer">
					<JsonViewer :data="payload?.params" :requestId="requestId" />
				</Flex>
			</Flex>

			<FeeJuiceCard />
		</Flex>

		<Flex direction="column" gap="10">
			<Tooltip v-if="processingError.show" side="top" position="start" :disabled="!processingError.tooltip">
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
					@click="handleConfirm"
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

		<Flex
			v-if="isRequestExpired"
			align="center"
			justify="center"
			:class="$style.request_expired_overlay"
		>
			<Flex direction="column" align="center" gap="16" :class="$style.request_expired_content">
				<Text size="13" weight="600" color="primary">This operation request is expired</Text>

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
