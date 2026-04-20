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

/** Anti-phishing: show the normalized hostname (not raw URL) and flag
 *  IDN / punycode so homograph attacks are visible. */
const dappHostname = computed(() => {
	if (!dapp.value?.url) return ""
	try {
		return new URL(dapp.value.url).hostname
	} catch {
		return dapp.value.url
	}
})
const hostnameHasNonAscii = computed(() => {
	const h = dappHostname.value
	for (const ch of h) {
		if (ch.charCodeAt(0) > 127) return true
	}
	return h.split(".").some((label) => label.startsWith("xn--"))
})

const stripStatus = computed<"ready" | "loading" | "cancelled">(() => {
	if (isInteractionCancelled.value) return "cancelled"
	if (isLoading.value) return "loading"
	return "ready"
})

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
	if (isInteractionCancelled.value || isLoading.value || !requestId.value) return
	try {
		isLoading.value = true
		await interactionService.resolveInteraction(requestId.value, { approved: true })
		closeWindow(true)
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	if (isInteractionCancelled.value || !requestId.value) return
	interactionService.rejectInteraction(requestId.value, "User rejected")
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
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<!-- Identity strip: anti-phishing trust anchor. -->
		<Flex align="center" justify="between" gap="12" :class="$style.identity_strip">
			<Flex align="center" gap="8">
				<span :class="[$style.status_dot, $style[`status_${stripStatus}`]]" />
				<span :class="$style.identity_account">{{ appStore.account?.name ?? "No account" }}</span>
				<span :class="$style.identity_sep">·</span>
				<span :class="$style.identity_network">{{ appStore.network?.name ?? "" }}</span>
			</Flex>
			<span :class="$style.identity_brand">NULO</span>
		</Flex>

		<Flex direction="column" :class="$style.scroll_area">
			<!-- dApp identity block -->
			<Flex align="center" gap="12" :class="$style.dapp_block">
			<div :class="$style.dapp_logo_wrapper">
				<Icon v-if="dapp?.loadingLogo" :loading="true" name="dapp" size="24" color="tertiary" />
				<img v-else-if="dapp?.logoBlobUrl" :src="dapp?.logoBlobUrl" :class="$style.dapp_logo" alt="" />
				<Icon v-else name="dapp" size="24" color="tertiary" />
			</div>

			<Flex direction="column" gap="4" wide :class="$style.dapp_info">
				<Flex align="center" gap="6">
					<span :class="$style.dapp_hostname">{{ dappHostname }}</span>
					<Tooltip v-if="hostnameHasNonAscii" position="start">
						<Icon name="warning" size="12" color="orange" />
						<template #content>
							<Text size="12" color="secondary" :style="{ lineHeight: '1.3' }">
								This hostname contains non-ASCII or punycoded characters. Verify carefully — some characters can imitate Latin letters.
							</Text>
						</template>
					</Tooltip>
				</Flex>
				<span v-if="dapp?.name" :class="$style.dapp_name">{{ dapp.name }}</span>
				<span :class="$style.dapp_action">wants to connect to your wallet</span>
			</Flex>
		</Flex>

			<!-- Body: trust reminder -->
			<Flex direction="column" gap="8" :class="$style.body">
				<Text size="12" color="tertiary" :style="{ lineHeight: '1.5' }">
					Make sure you trust the site you're connecting to. You can revoke this connection any time from Settings → General → Sessions.
				</Text>
			</Flex>
		</Flex>

		<!-- Footer: error + actions -->
		<Flex direction="column" gap="10" :class="$style.footer">
			<Tooltip v-if="processingError" side="top" position="start" wide :disabled="!processingError.tooltip">
				<Flex align="center" wide gap="6">
					<Icon name="info" size="14" :color="processingError.type === 'warning' ? 'orange' : 'red'" />
					<Text size="12" weight="600" color="secondary">{{ processingError.title }}</Text>
				</Flex>

				<template #content>
					<Text size="12" color="secondary">{{ processingError.tooltip }}</Text>
				</template>
			</Tooltip>

			<Flex align="center" justify="between" gap="12">
				<Button @click="reject" wide type="primary_outline" size="medium" :disabled="isLoading">
					Deny
				</Button>

				<Button
					@click="approve"
					wide
					type="primary"
					size="medium"
					:loading="isLoading"
					:disabled="processingError?.type === 'error'"
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
	overflow: hidden;
	flex: 1;

	display: flex;
	flex-direction: column;

	background: var(--app-bg);
	border-top: 2px solid var(--nulo-accent);
}

.scroll_area {
	flex: 1;
	min-height: 0;
	overflow: auto;
	scrollbar-gutter: stable;
}

/* ── Identity strip ────────────────────────────────────────────── */

.identity_strip {
	flex-shrink: 0;

	padding: 10px 16px;
	background: var(--nulo-surface);
	border-bottom: 1px solid var(--nulo-border);
}

.status_dot {
	display: inline-block;
	width: 6px;
	height: 6px;
	flex-shrink: 0;
}

.status_ready { background: var(--green); }
.status_loading { background: var(--orange); }
.status_cancelled { background: var(--red); }

.identity_account {
	font-family: var(--font-headline);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 140px;
}

.identity_sep {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-outline);
}

.identity_network {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 80px;
}

.identity_brand {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.2em;
	color: var(--nulo-outline);
}

/* ── dApp identity block ───────────────────────────────────────── */

.dapp_block {
	flex-shrink: 0;

	padding: 16px;
	border-bottom: 1px solid var(--nulo-border);
}

.dapp_logo_wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;

	width: 40px;
	height: 40px;

	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);
}

.dapp_logo {
	width: 40px;
	height: 40px;
	object-fit: cover;
}

.dapp_info {
	min-width: 0;
}

.dapp_hostname {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.01em;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dapp_name {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dapp_action {
	font-family: var(--font-body);
	font-size: 12px;
	color: var(--nulo-secondary);
}

/* ── Body ──────────────────────────────────────────────────────── */

.body {
	padding: 16px;
}

/* ── Footer ────────────────────────────────────────────────────── */

.footer {
	flex-shrink: 0;

	padding: 16px;
	border-top: 1px solid var(--nulo-border);
	background: var(--nulo-surface);
}

/* ── Cancellation overlay ──────────────────────────────────────── */

.notification_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(10, 9, 8, 0.8);
	z-index: 1000;
}

.notification_content {
	width: 90%;

	padding: 16px;
	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);

	text-align: center;
	line-height: 1.2;
	z-index: 1001;
}
</style>
