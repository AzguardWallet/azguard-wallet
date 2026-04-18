<script setup lang="ts">
/** Components */
import EmojiGrid from "@/popup/components/modules/general/EmojiGrid.vue"

/** Vendor */
import { onMounted, onUnmounted } from "vue"
import { hashToEmoji } from "@aztec/wallet-sdk/crypto"

/** Services */
import { DappSessionServiceClient, type DappSession, type DappMetadata } from "@/wallet/services/dapp-session/client"
import { type Account, AccountServiceClient } from "@/wallet/services/account/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"

/** Composables */
// @ts-expect-error
const { loadExternalImage } = useExternalImage()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

type UIDappMetadata = DappMetadata & {
	loadingLogo?: boolean
	logoBlobUrl?: string
}

const router = useRouter()

const session = ref<DappSession>()
const dapp = ref<UIDappMetadata>()
const emojis = ref("")
const isReconnect = ref(false)
const alwaysTrust = ref(false)

/** Signer resolution for the identity strip. */
const signerAccounts = ref<Account[]>([])
const signerDisplay = computed(() => {
	if (signerAccounts.value.length === 1) return signerAccounts.value[0].name
	if (signerAccounts.value.length > 1) return `${signerAccounts.value.length} accounts`
	// Fallback: trimmed address from first CAIP string
	const first = session.value?.accounts?.[0]
	if (!first) return "No account"
	const addr = first.split(":")[2] ?? ""
	return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr
})
const signerNetwork = computed(() => {
	if (signerAccounts.value.length === 1) {
		const acc = signerAccounts.value[0]
		return typeof acc.chainId === "number" ? `chain ${acc.chainId}` : String(acc.chainId ?? "")
	}
	if (signerAccounts.value.length > 1) return "MIXED"
	return ""
})

/** Anti-phishing: normalized hostname + IDN / punycode flag. */
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

const dappSessionService = new DappSessionServiceClient()

const handleConfirm = async () => {
	if (alwaysTrust.value && session.value) {
		await dappSessionService.setTrustedVerification(session.value.id, true)
	}
	closeWindow()
}

const closeWindow = () => {
	chrome.windows.getCurrent(undefined, (window) => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

async function resolveSigners() {
	if (!session.value?.accounts?.length || !appStore.profile) return
	const networkService = new NetworkServiceClient()
	const accountService = new AccountServiceClient()
	try {
		const resolved: Account[] = []
		for (const caip of session.value.accounts) {
			const [_, chainIdStr, address] = caip.split(":")
			const chainId = Number(chainIdStr)
			if (!Number.isFinite(chainId) || !address) continue
			const networks = await networkService.getNetworks(chainId)
			if (!networks.length) continue
			const network = networks.find((n) => n.isDefault) ?? networks[0]
			const account = await accountService.getAccount(appStore.profile.id, network.chainId, address)
			if (account) resolved.push(account)
		}
		signerAccounts.value = resolved
	} finally {
		networkService.disconnect()
		accountService.disconnect()
	}
}

onMounted(async () => {
	dappSessionService.connect()

	// Wait for app to establish session before resolving signer names.
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

	const sessionId = router.currentRoute.value.query.sessionId as string
	isReconnect.value = router.currentRoute.value.query.isReconnect === "true"

	if (!sessionId) {
		closeWindow()
		return
	}

	try {
		session.value = await dappSessionService.getDappSession(sessionId)
		if (!session.value) {
			closeWindow()
			return
		}

		if (session.value.verificationHash) {
			emojis.value = hashToEmoji(session.value.verificationHash)
		}

		// Hydrate dApp logo
		dapp.value = session.value.dappMetadata
		if (dapp.value?.logo) {
			dapp.value.loadingLogo = true
			try {
				dapp.value.logoBlobUrl = await loadExternalImage(dapp.value.logo)
			} finally {
				dapp.value.loadingLogo = false
			}
		}

		// Resolve wallet-local signer name(s) for the identity strip
		await resolveSigners()
	} catch {
		closeWindow()
	}
})

onUnmounted(() => {
	dappSessionService.disconnect()
})
</script>

<template>
	<Flex v-if="session" direction="column" :class="$style.wrapper">
		<!-- Identity strip: anti-phishing trust anchor. Status is always ready on verify. -->
		<Flex align="center" justify="between" gap="12" :class="$style.identity_strip">
			<Flex align="center" gap="8">
				<span :class="[$style.status_dot, $style.status_ready]" />
				<span :class="$style.identity_account">{{ signerDisplay }}</span>
				<span v-if="signerNetwork" :class="$style.identity_sep">·</span>
				<span
					v-if="signerNetwork"
					:class="[$style.identity_network, signerAccounts.length > 1 && $style.identity_warn]"
				>
					{{ signerNetwork }}
				</span>
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
				<span :class="$style.dapp_action">{{ isReconnect ? "Reconnected" : "Connection established" }}</span>
			</Flex>
		</Flex>

			<!-- Verification section -->
			<Flex v-if="emojis" direction="column" gap="12" :class="$style.verification">
				<SectionLabel label="Connection verification" />

				<Flex direction="column" align="center" gap="12">
					<EmojiGrid :emojis="emojis" />
					<Text size="12" color="secondary" :style="{ textAlign: 'center', lineHeight: '1.4' }">
						Verify these emojis match what the app displays to confirm a secure connection
					</Text>
				</Flex>
			</Flex>
		</Flex>

		<!-- Footer: trust toggle + OK -->
		<Flex direction="column" gap="12" :class="$style.footer">
			<Flex align="center" justify="between" gap="12" wide>
				<Flex direction="column" gap="4">
					<Text size="13" weight="600" color="primary">Always trust</Text>
					<Text size="12" weight="500" color="tertiary">Skip verification on reconnect</Text>
				</Flex>
				<Toggle :modelValue="alwaysTrust" @update:modelValue="(v: boolean) => (alwaysTrust = v)" />
			</Flex>

			<Button @click="handleConfirm" wide type="primary" size="medium">
				<Text size="13" color="inverse">OK</Text>
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: hidden;

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

.identity_warn {
	color: var(--orange);
	font-weight: 700;
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

/* ── Verification section ──────────────────────────────────────── */

.verification {
	padding: 16px;
}

/* ── Footer ────────────────────────────────────────────────────── */

.footer {
	flex-shrink: 0;

	padding: 16px;
	border-top: 1px solid var(--nulo-border);
	background: var(--nulo-surface);
}
</style>
