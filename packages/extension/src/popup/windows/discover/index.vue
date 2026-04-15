<script setup lang="ts">
/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Utils */
import { getErrorData } from "@/wallet/utils/errors"

/** Services */
import { type ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import type { DappMetadata } from "@/wallet/services/dapp-session/client"
import { type DiscoveryPayload, DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

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
// @ts-expect-error
const { loadExternalImage } = useExternalImage()

const router = useRouter()

const profile = ref<ProfileInfo>()
const requestId = ref<string>()
const payload = ref<DiscoveryPayload>()
const dapp = ref<UIDappMetadata>()

const isLoading = ref(false)
const isInteractionCancelled = ref(false)
const processingError = ref<UIError>()

function setError(title: string, tooltip: string = title, type: string = "error") {
	processingError.value = { title, tooltip, type }
}

const init = async () => {
	try {
		profile.value = await profileService.getActiveProfile()
		requestId.value = router.currentRoute.value.query.requestId?.toString()
		if (!requestId.value) {
			throw new Error("Invalid interaction request id")
		}
		payload.value = (await interactionService.getInteractionPayload(requestId.value)) as DiscoveryPayload
		dapp.value = payload.value.params.dappMetadata

		if (dapp.value.logo) {
			dapp.value.loadingLogo = true
			try {
				dapp.value.logoBlobUrl = await loadExternalImage(dapp.value.logo)
			} finally {
				dapp.value.loadingLogo = false
			}
		}
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	}
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
		await interactionService.resolveInteraction(requestId.value!, { approved: true })
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

const closeWindow = (interactionCompleted?: boolean) => {
	if (interactionCompleted) {
		window.removeEventListener("beforeunload", reject)
	}
	chrome.windows.getCurrent(undefined, (window) => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

const profileService = new ProfileServiceClient()
profileService.onActiveProfileChanged.add(onActiveProfileChanged)

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

onMounted(async () => {
	profileService.connect()
	interactionService.connect()

	if (!appStore.isSessionChecked) {
		await new Promise<void>((resolve) => {
			const stop = watch(
				() => appStore.isSessionChecked,
				(checked) => {
					if (checked) {
						stop()
						resolve()
					}
				},
				{ immediate: true },
			)
		})
	}

	if (!appStore.isLogined) {
		appStore.pageAwaitingAuth = router.currentRoute.value.fullPath
		router.push({ path: "/popup/auth" })
		return
	}

	await init()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	profileService.disconnect()
	interactionService.disconnect()
	window.removeEventListener("beforeunload", reject)
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="16">
			<Flex align="center" justify="center" gap="8" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">Connection request</Text>
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
					:class="isLoading && $style.status_icon"
					:style="{ paddingBottom: '13px' }"
				>
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<img width="48" height="48" src="@/assets/logo_lg.png" />

					<Text size="13" weight="600" color="primary">Nulo</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{ marginTop: '-4px' }">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
					<Text size="13" color="primary">This application wants to connect to your wallet</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">Make sure you trust the site you interact with</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10" style="margin-top: 16px">
			<Tooltip v-if="processingError" side="top" position="start" wide :disabled="!processingError.tooltip">
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
					<Text size="13">Deny</Text>
				</Button>

				<Button
					@click="approve"
					wide
					type="primary"
					size="medium"
					:loading="isLoading"
					:disabled="processingError"
				>
					<Text size="13" color="inverse">Allow</Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isInteractionCancelled" align="center" justify="center" :class="$style.notification_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.notification_content">
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
	overflow: auto;
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

.notification_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.4);
	z-index: 1000;
}

.notification_content {
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
