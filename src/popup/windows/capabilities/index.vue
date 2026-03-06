<script setup lang="ts">
/** Vendor */
import { onBeforeMount, onMounted, onUnmounted } from "vue"

/** Components */
// @ts-ignore
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import CapabilityCard from "@/popup/components/modules/capabilities/CapabilityCard.vue"
import EmojiGrid from "@/popup/components/modules/capabilities/EmojiGrid.vue"

/** Utils */
import { getErrorData } from "@/wallet/utils/errors"
import { capabilitiesToPermissions } from "@/wallet/services/aztec-sdk/adapter"

/** Types */
import type { Capability } from "@aztec/aztec.js/wallet"

/** Capability models */
import {
	type UICapability,
	AccountsUICapability,
	createUICapability,
} from "@/popup/components/modules/capabilities/models"

/** Services */
import { ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import { Network, NetworkServiceClient } from "@/wallet/services/network/client"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { DappMetadata } from "@/wallet/services/dapp-session/client"
import { CapabilitiesPayload, DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

type UIDappMetadata = DappMetadata & {
	loadingLogo?: boolean
	logoBlobUrl?: string
}

type UIError = {
	title: string
	tooltip: string
	type: string
}

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Composables */
// @ts-ignore
const { loadExternalImage } = useExternalImage()

const router = useRouter()

const profile = ref<ProfileInfo>()
const networks = ref<Network[]>()

const requestId = ref<string>()
const payload = ref<CapabilitiesPayload>()
const dapp = ref<UIDappMetadata>()
const capabilities = ref<UICapability[]>([])

const isLoading = ref(false)

const verificationHash = computed(() => payload.value?.params?.verificationHash ?? null)

const truncate = (value: string | undefined, max: number) =>
	value && value.length > max ? value.slice(0, max) + "…" : value

const manifestName = computed(() => truncate(payload.value?.params.manifest.metadata?.name, 30))
const manifestVersion = computed(() => truncate(payload.value?.params.manifest.metadata?.version, 20))
const isInteractionCancelled = ref(false)
const processingError = ref<UIError>()

const initRequest = async () => {
	try {
		profile.value = await profileService.getActiveProfile()
		networks.value = await networkService.getNetworks()
		requestId.value = router.currentRoute.value.query.requestId as string
		if (!requestId.value) {
			throw new Error("Invalid interaction request id")
		}
		payload.value = (await interactionService.getInteractionPayload(requestId.value)) as CapabilitiesPayload
		dapp.value = {
			...payload.value.params.dappMetadata,
		}

		// Load app icon from manifest metadata if available
		const manifestIcon = payload.value.params.manifest.metadata.icon
		if (manifestIcon) {
			dapp.value.loadingLogo = true
			try {
				dapp.value.logoBlobUrl = await loadExternalImage(manifestIcon)
			} finally {
				dapp.value.loadingLogo = false
			}
		} else if (dapp.value.logo) {
			dapp.value.loadingLogo = true
			try {
				dapp.value.logoBlobUrl = await loadExternalImage(dapp.value.logo)
			} finally {
				dapp.value.loadingLogo = false
			}
		}

		capabilities.value = payload.value.params.manifest.capabilities
			.map(createUICapability)
			.filter((c): c is UICapability => c !== null)
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	}
}

const initAccounts = async () => {
	if (!profile.value || !networks.value || !payload.value) return

	const chainId = payload.value.params.chainId
	const network = networks.value.find(x => x.chainId === chainId)
	if (!network) return

	const accountClient = new AccountServiceClient()
	const accounts = await accountClient.getAccounts(profile.value.id, network.chainId, true)

	for (const cap of capabilities.value) {
		if (cap.capability.type === "accounts") {
			(cap as AccountsUICapability).accounts = accounts
		}
	}
}

function setError(title: string, tooltip: string = title, type: string = "error") {
	processingError.value = { title, tooltip, type }
}

function clearError() {
	processingError.value = undefined
}

const toggleCapability = (idx: number) => {
	capabilities.value[idx].toggle()
}

const denySubPermission = (idx: number, key: string) => {
	if (processingError.value?.type === "warning") clearError()
	capabilities.value[idx].deny(key)
}

const restoreSubPermission = (idx: number, key: string) => {
	if (processingError.value?.type === "warning") clearError()
	capabilities.value[idx].restore(key)
}

const showJson = () => {
	if (!requestId.value) return
	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/json"))
	url.searchParams.set("requestId", requestId.value)
	chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 900 })
}

const onActiveProfileChanged = (_profile?: ProfileInfo) => {
	if (!_profile || _profile.id !== profile.value?.id) {
		reject()
	}
}

const onInteractionCancelled = (_requestId: string) => {
	if (requestId.value === _requestId) {
		isInteractionCancelled.value = true
	}
}

const approve = async () => {
	try {
		isLoading.value = true

		const narrowedCaps = capabilities.value
			.map(c => c.buildNarrowed())
			.filter((c): c is Capability => c !== null)
		const filteredManifest = {
			...payload.value!.params.manifest,
			capabilities: narrowedCaps,
		}

		// Build per-capability accounts map (index in narrowedCaps → addresses)
		const accountsMap = new Map<number, string[]>()
		let narrowedIdx = 0
		for (const c of capabilities.value) {
			if (c.buildNarrowed() !== null) {
				if (c.capability.type === "accounts") {
					accountsMap.set(narrowedIdx, (c as AccountsUICapability).getApprovedAddresses())
				}
				narrowedIdx++
			}
		}

		const result = capabilitiesToPermissions(
			filteredManifest,
			payload.value!.params.chainId,
			accountsMap,
		)

		await interactionService.resolveInteraction(requestId.value!, result)
		closeWindow(true)
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	interactionService.rejectInteraction(requestId.value!, "User rejected")
	closeWindow(true)
}

const closeWindow = (interactionCompleted: boolean) => {
	if (interactionCompleted) {
		window.removeEventListener("beforeunload", reject)
	}
	chrome.windows.getCurrent(undefined, window => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

const profileService = new ProfileServiceClient()
profileService.onActiveProfileChanged.add(onActiveProfileChanged)

const networkService = new NetworkServiceClient()

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

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
	networkService.connect()
	interactionService.connect()
	await initRequest()
	await initAccounts()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	profileService.disconnect()
	networkService.disconnect()
	interactionService.disconnect()
	window.removeEventListener("beforeunload", reject)
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="16">
			<Flex align="center" justify="center" gap="8" :class="$style.header_section">
				<Text size="16" weight="600" color="primary">Permission request</Text>
			</Flex>

			<Flex align="center" justify="center" gap="20">
				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<Icon v-if="dapp?.loadingLogo" :loading="true" name="dapp" size="48" color="tertiary" />
					<img v-else-if="dapp?.logoBlobUrl" width="48" height="48" :src="dapp?.logoBlobUrl" />
					<Icon v-else name="dapp" size="48" color="blue" />

					<Text size="13" weight="600" color="primary"> {{ dapp?.name ?? "Unknown DApp" }} </Text>
				</Flex>

				<Flex
					align="center"
					gap="12"
					:class="[$style.connect_icons, isLoading && $style.status_icon]"
				>
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<img width="48" height="48" src="@/assets/logo_lg.png" />

					<Text size="13" weight="600" color="primary">Azguard Wallet</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="4" :class="$style.dapp_info">
				<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
				<Text size="12" color="secondary">Make sure you trust the site you interact with</Text>
			</Flex>

			<Flex
				v-if="payload?.params.manifest.metadata"
				align="center"
				justify="between"
				wide
				:class="$style.metadata"
			>
				<Flex align="center" gap="6">
					<Tooltip side="bottom" position="start">
						<Icon name="warning" size="14" color="sand" />
						<template #content>
							<Text size="12" color="secondary">
								This metadata provided by dApp and not verified
							</Text>
						</template>
					</Tooltip>
					<Text size="12" color="secondary" noWrap>
						{{ manifestName }}
					</Text>
					<Text size="12" color="tertiary" noWrap>
						v{{ manifestVersion }}
					</Text>
				</Flex>
				<NetworkBadge :chainId="payload.params.chainId" />
			</Flex>

			<EmojiGrid v-if="verificationHash" :hash="verificationHash" />

			<Flex direction="column" align="start" justify="start" gap="8" :class="$style.capabilities_section">
				<Flex wide justify="between">
					<Text size="14" weight="600" color="primary">Requested capabilities:</Text>
					<Icon @click="showJson" name="expand" size="16" color="tertiary" :class="$style.fullscreen_icon" />
				</Flex>
				<CapabilityCard
					v-for="(cap, idx) in capabilities"
					:key="idx"
					:cap="cap"
					:disabled="isLoading || processingError?.type === 'error'"
					@toggle="toggleCapability(idx)"
					@deny="denySubPermission(idx, $event)"
					@restore="restoreSubPermission(idx, $event)"
				/>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10" :class="$style.footer">
			<Tooltip v-if="processingError" side="top" position="start" wide :disabled="!processingError.tooltip">
				<Flex align="center" wide>
					<Icon name="info" size="14" :color="processingError.type === 'warning' ? 'orange' : 'red'" />
					<Text size="12" weight="600" color="secondary" :class="$style.error_text">
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
					:disabled="!capabilities.some(c => c.selected) || processingError?.type === 'error'"
				>
					<Text size="13" color="inverse">Approve</Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isInteractionCancelled" align="center" justify="center" :class="$style.proposal_expired_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.proposal_expired_content">
				<Text size="13" weight="600" color="primary">Capabilities request was cancelled</Text>

				<Button @click="closeWindow" type="primary" size="small" :class="$style.close_btn">
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

.header_section {
	padding-top: 8px;
}

.connect_icons {
	padding-bottom: 13px;
}

.dapp_info {
	margin-top: -4px;
}

.metadata {
	width: 100%;
	padding: 8px 12px;
	border-radius: 8px;
	background: var(--gray-3);
	overflow: hidden;
}

.capabilities_section {
	padding-bottom: 8px;
}

.footer {
	margin-top: 16px;
}

.error_text {
	padding-left: 4px;
}

.close_btn {
	width: 50%;
}

.fullscreen_icon {
	cursor: pointer;

	&:hover {
		background: var(--op-10);
	}
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
