<script setup lang="ts">
/** Components */
import CapabilityDetailPanel from "@/popup/components/modules/capabilities/CapabilityDetailPanel.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Utils */
import { getErrorData } from "@/wallet/utils/errors"

/** Services */
import { type ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import type { DappMetadata } from "@/wallet/services/dapp-session/client"
import { type CapabilityPayload, DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

type UIDappMetadata = DappMetadata & {
	loadingLogo?: boolean
	logoBlobUrl?: string
}

type UIAccount = {
	address: string
	name: string
	chainId: number
}

type UICapability = {
	capability: Record<string, unknown>
	label: string
	description: string
	isNew: boolean
	selected: boolean
	risk: "low" | "medium" | "high"
	reRequested: boolean
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
const payload = ref<CapabilityPayload>()
const dapp = ref<UIDappMetadata>()
const capabilities = ref<UICapability[]>([])

/** Account selection state */
const needsAccountSelection = ref(false)
const availableAccounts = ref<UIAccount[]>([])
const selectedAccounts = ref<UIAccount[]>([])
const accountAliases = ref<Record<string, string>>({})

const isLoading = ref(false)
const isInteractionCancelled = ref(false)
const processingError = ref<UIError>()
const expandedCards = ref(new Set<number>())

const toggleExpand = (index: number) => {
	if (expandedCards.value.has(index)) {
		expandedCards.value.delete(index)
	} else {
		expandedCards.value.add(index)
	}
}

const isExpanded = (index: number) => expandedCards.value.has(index)

const CAPABILITY_LABELS: Record<string, { label: string; description: string; risk: "low" | "medium" | "high" }> = {
	accounts: { label: "Share your accounts", description: "The dApp can see your account addresses and aliases", risk: "medium" },
	contracts: {
		label: "Register and query contracts",
		description: "Register contract instances and read contract metadata",
		risk: "low",
	},
	contractClasses: { label: "Query contract classes", description: "Read contract class metadata from the network", risk: "low" },
	simulation: { label: "Simulate transactions", description: "Run transaction simulations without sending them", risk: "medium" },
	transaction: { label: "Send transactions", description: "Submit transactions to the network on your behalf", risk: "high" },
	data: { label: "Access private data", description: "Read private notes and events from your account", risk: "high" },
}

function getCapabilityInfo(type: string) {
	return CAPABILITY_LABELS[type] ?? { label: type, description: `Capability: ${type}`, risk: "medium" as const }
}

function setError(title: string, tooltip: string = title, type: string = "error") {
	processingError.value = { title, tooltip, type }
}

function clearError() {
	processingError.value = undefined
}

/** Anti-phishing: show the normalized hostname (not raw URL) and flag
 *  IDN / non-ASCII so homograph attacks are visible. */
const dappHostname = computed(() => {
	if (!dapp.value?.url) return ""
	try {
		return new URL(dapp.value.url).hostname
	} catch {
		return dapp.value.url
	}
})
/** Flags hostnames that could be homograph attacks:
 *  - non-ASCII codepoints (raw IDN)
 *  - punycode labels (xn-- prefix; ASCII-encoded IDN — looks innocuous here
 *    but indicates the registered domain uses non-ASCII characters) */
const hostnameHasNonAscii = computed(() => {
	const h = dappHostname.value
	for (const ch of h) {
		if (ch.charCodeAt(0) > 127) return true
	}
	return h.split(".").some((label) => label.startsWith("xn--"))
})

/** Status dot semantic for the identity strip. */
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
		payload.value = (await interactionService.getInteractionPayload(requestId.value)) as CapabilityPayload
		dapp.value = payload.value.session.dappMetadata

		if (dapp.value.logo) {
			dapp.value.loadingLogo = true
			try {
				dapp.value.logoBlobUrl = await loadExternalImage(dapp.value.logo)
			} finally {
				dapp.value.loadingLogo = false
			}
		}

		// Check if accounts type is in delta — show account selection instead of card
		const hasAccountsInDelta = payload.value.params.delta.some((cap: Record<string, unknown>) => cap.type === "accounts")
		if (hasAccountsInDelta) {
			if (payload.value.params.availableAccounts?.length) {
				needsAccountSelection.value = true
				availableAccounts.value = payload.value.params.availableAccounts
			} else {
				// No accounts on this network — warn and disable accounts capability
				const { openToast } = useToast()
				openToast({ label: "No accounts available for this network. Create one first.", icon: "info" }, TOAST_DURATION.LONG)
			}
		}

		// Build UI capabilities list (filter out accounts type — handled by section)
		const items: UICapability[] = []
		const reRequestedTypes = new Set(payload.value.params.reRequested ?? [])

		// New capabilities (delta) — toggleable, default ON — skip accounts type
		for (const cap of payload.value.params.delta) {
			if (cap.type === "accounts") continue
			const info = getCapabilityInfo(cap.type)
			items.push({
				capability: cap,
				label: info.label,
				description: info.description,
				isNew: true,
				selected: true,
				risk: info.risk,
				reRequested: reRequestedTypes.has(cap.type),
			})
		}

		// Already-granted capabilities — non-interactive context
		for (const cap of payload.value.params.existingGrants) {
			const info = getCapabilityInfo(cap.type)
			items.push({
				capability: cap,
				label: info.label,
				description: info.description,
				isNew: false,
				selected: true,
				risk: info.risk,
				reRequested: false,
			})
		}

		capabilities.value = items
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	}
}

const toggleCapability = (index: number) => {
	const cap = capabilities.value[index]
	if (cap.isNew) {
		cap.selected = !cap.selected
	}
}

const selectAccount = (account: UIAccount) => {
	if (processingError.value?.type === "warning") {
		clearError()
	}
	const index = selectedAccounts.value.findIndex((acc) => acc.address === account.address)
	if (index < 0) {
		selectedAccounts.value.push(account)
	} else {
		selectedAccounts.value.splice(index, 1)
	}
}

const isAccountSelected = (account: UIAccount) => {
	return selectedAccounts.value.some((acc) => acc.address === account.address)
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
	// Validate account selection if needed
	if (needsAccountSelection.value && selectedAccounts.value.length === 0) {
		setError("Select at least one account", "You must select at least one account to share with the dApp", "warning")
		return
	}
	try {
		isLoading.value = true
		const approvedNew = capabilities.value.filter((c) => c.isNew && c.selected).map((c) => c.capability)
		const existing = capabilities.value.filter((c) => !c.isNew).map((c) => c.capability)

		// Re-add the accounts capability to granted if accounts were selected
		const granted = [...approvedNew, ...existing]
		if (needsAccountSelection.value && selectedAccounts.value.length > 0) {
			const accountsCap = payload.value!.params.delta.find((cap: Record<string, unknown>) => cap.type === "accounts")
			if (accountsCap) {
				granted.push(accountsCap)
			}
		}

		// Build account result
		let resultSelectedAccounts: string[] | undefined
		let resultAliases: Record<string, string> | undefined
		if (needsAccountSelection.value && selectedAccounts.value.length > 0) {
			resultSelectedAccounts = selectedAccounts.value.map((acc) => `aztec:${acc.chainId}:${acc.address}`)
			resultAliases = {}
			for (const acc of selectedAccounts.value) {
				const caip = `aztec:${acc.chainId}:${acc.address}`
				resultAliases[caip] = accountAliases.value[caip] || acc.name
			}
		}

		await interactionService.resolveInteraction(requestId.value!, {
			granted,
			selectedAccounts: resultSelectedAccounts,
			accountAliases: resultAliases,
		})
		closeWindow(true)
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	// Guard against double-reject on the cancellation overlay path where
	// closeWindow() can trigger beforeunload -> reject() on an already
	// cancelled interaction.
	if (isInteractionCancelled.value) return
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
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<!-- Identity strip: anti-phishing trust anchor. Rendered by extension chrome; can't be spoofed by dApp iframe. -->
		<Flex align="center" justify="between" gap="12" :class="$style.identity_strip">
			<Flex align="center" gap="8">
				<span :class="[$style.status_dot, $style[`status_${stripStatus}`]]" />
				<span :class="$style.identity_account">{{ appStore.account?.name ?? "No account" }}</span>
				<span :class="$style.identity_sep">·</span>
				<span :class="$style.identity_network">{{ appStore.network?.name ?? "" }}</span>
			</Flex>
			<span :class="$style.identity_brand">NULO</span>
		</Flex>

		<!-- dApp identity block: hostname dominant, normalized, IDN flagged -->
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
								This hostname contains non-ASCII characters. Verify carefully — some characters can imitate Latin letters.
							</Text>
						</template>
					</Tooltip>
				</Flex>
				<span v-if="dapp?.name" :class="$style.dapp_name">{{ dapp.name }}</span>
				<span :class="$style.dapp_action">is requesting access to Nulo</span>
			</Flex>
		</Flex>

		<!-- Sections -->
		<Flex direction="column" gap="20" :class="$style.sections">
			<!-- Account selection section -->
			<Flex v-if="needsAccountSelection" direction="column" gap="10" wide>
				<SectionLabel label="Select accounts to share" :count="availableAccounts.length" />

				<ItemsContainer>
					<div
						v-for="acc in availableAccounts"
						:key="acc.address"
						role="button"
						tabindex="0"
						@click="selectAccount(acc)"
						@keydown.enter="selectAccount(acc)"
						:class="[$style.row, (isLoading || processingError?.type === 'error') && $style.row_disabled]"
					>
						<Flex align="center" gap="12" wide>
							<Icon
								v-if="isAccountSelected(acc)"
								name="check-circle"
								size="16"
								color="primary"
								:class="$style.row_check"
							/>
							<Icon v-else name="circle" size="16" color="secondary" :class="$style.row_check" />

							<Flex direction="column" gap="2" wide :class="$style.row_text">
								<Flex align="center" justify="between" gap="8" wide>
									<span :class="$style.row_name">{{ acc.name }}</span>
									<NetworkBadge :chainId="acc.chainId" />
								</Flex>
								<span :class="$style.row_address">{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}</span>
							</Flex>
						</Flex>

						<Flex
							v-if="isAccountSelected(acc)"
							direction="column"
							gap="4"
							wide
							:class="$style.alias_block"
							@click.stop
							@keydown.stop
						>
							<Flex align="center" gap="4">
								<span :class="$style.alias_label">Alias</span>
								<Tooltip position="start">
									<Icon name="info" size="11" color="tertiary" />
									<template #content>
										<Text size="12" color="secondary" :style="{ lineHeight: '1.2' }">
											A private name for this account visible only to this app
										</Text>
									</template>
								</Tooltip>
							</Flex>
							<input
								:value="accountAliases[`aztec:${acc.chainId}:${acc.address}`] ?? acc.name"
								@input="accountAliases[`aztec:${acc.chainId}:${acc.address}`] = ($event.target as HTMLInputElement).value"
								:class="$style.alias_input"
								:placeholder="acc.name"
							/>
						</Flex>
					</div>
				</ItemsContainer>
			</Flex>

			<!-- New capabilities (delta) — accounts type excluded -->
			<Flex v-if="capabilities.filter(c => c.isNew).length" direction="column" gap="10" wide>
				<SectionLabel label="New capabilities requested" :count="capabilities.filter(c => c.isNew).length" />

				<Flex direction="column" gap="6" wide>
					<Flex
						v-for="(cap, i) in capabilities"
						v-show="cap.isNew"
						:key="`new-${i}`"
						direction="column"
						:class="[$style.cap_card, (isLoading || processingError?.type === 'error') && $style.cap_disabled]"
					>
						<Flex @click="toggleExpand(i)" gap="10" :class="$style.cap_head">
							<Flex align="center" @click.stop="toggleCapability(i)" :class="$style.checkbox_hit">
								<Icon v-if="cap.selected" name="check-circle" size="16" color="green" />
								<Icon v-else name="circle" size="16" color="secondary" />
							</Flex>

							<Flex direction="column" gap="2" wide>
								<Flex align="center" justify="between" gap="8">
									<Flex align="center" gap="6">
										<Text size="14" weight="600" color="primary">{{ cap.label }}</Text>
										<span v-if="cap.reRequested" :class="$style.denied_badge">previously denied</span>
									</Flex>
									<Flex align="center" gap="6">
										<Text
											size="11"
											weight="600"
											:color="cap.risk === 'high' ? 'red' : cap.risk === 'medium' ? 'yellow' : 'green'"
										>
											{{ cap.risk }}
										</Text>
										<Icon
											name="chevron"
											size="12"
											color="tertiary"
											:style="{ transform: isExpanded(i) ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }"
										/>
									</Flex>
								</Flex>
								<Text size="12" color="secondary" :style="{ lineHeight: '1.4' }">
									{{ cap.description }}
								</Text>
							</Flex>
						</Flex>

						<CapabilityDetailPanel v-if="isExpanded(i)" :capability="cap.capability" :granted="false" />
					</Flex>
				</Flex>
			</Flex>

			<!-- Already granted -->
			<Flex v-if="capabilities.filter(c => !c.isNew).length" direction="column" gap="10" wide>
				<SectionLabel label="Already granted" :count="capabilities.filter(c => !c.isNew).length" />

				<Flex direction="column" gap="6" wide>
					<Flex
						v-for="(cap, i) in capabilities"
						v-show="!cap.isNew"
						:key="`existing-${i}`"
						direction="column"
						:class="[$style.cap_card, $style.cap_granted]"
					>
						<Flex gap="10" :class="$style.cap_head_readonly">
							<Flex align="center">
								<Icon name="check-circle" size="16" color="tertiary" />
							</Flex>

							<Flex direction="column" gap="2" wide>
								<Flex align="center" justify="between" gap="8">
									<Text size="14" weight="600" color="tertiary">{{ cap.label }}</Text>
									<Icon
										@click.stop="toggleExpand(i)"
										name="chevron"
										size="12"
										color="tertiary"
										:style="{ transform: isExpanded(i) ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', cursor: 'pointer' }"
									/>
								</Flex>
								<Text size="12" color="tertiary" :style="{ lineHeight: '1.4' }">
									{{ cap.description }}
								</Text>
							</Flex>
						</Flex>

						<CapabilityDetailPanel v-if="isExpanded(i)" :capability="cap.capability" :granted="true" />
					</Flex>
				</Flex>
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
				<Button @click="reject" wide type="secondary" size="medium" :disabled="isLoading">
					<Text size="13">Reject</Text>
				</Button>

				<Button
					@click="approve"
					wide
					type="primary"
					size="medium"
					:loading="isLoading"
					:disabled="processingError?.type === 'error'"
				>
					<Text size="13" color="inverse">Approve</Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isInteractionCancelled" align="center" justify="center" :class="$style.notification_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.notification_content">
				<Text size="13" weight="600" color="primary">Capability request was cancelled</Text>

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

	display: flex;
	flex-direction: column;

	background: var(--app-bg);
	border-top: 2px solid var(--nulo-accent);
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

.status_ready {
	background: var(--green);
}

.status_loading {
	background: var(--orange);
}

.status_cancelled {
	background: var(--red);
}

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
	max-width: 120px;
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

/* ── Sections ──────────────────────────────────────────────────── */

.sections {
	padding: 16px;
}

/* ── Account rows ──────────────────────────────────────────────── */

.row {
	position: relative;

	display: flex;
	flex-direction: column;
	gap: 10px;

	padding: 12px 14px;
	cursor: pointer;
	outline: none;
	background: transparent;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}

	&:focus-visible {
		background: var(--nulo-surface-high);
	}

	&::after {
		position: absolute;
		bottom: 0;
		left: 14px;
		right: 14px;
		display: block;
		height: 1px;

		background: rgba(74, 70, 63, 0.3);

		content: " ";
	}

	&:last-child::after {
		display: none;
	}
}

.row_disabled {
	cursor: default;
	pointer-events: none;
	opacity: 0.5;
}

.row_check {
	flex-shrink: 0;
}

.row_text {
	min-width: 0;
}

.row_name {
	font-family: var(--font-body);
	font-size: 14px;
	font-weight: 600;
	color: var(--txt-primary);
	line-height: 20px;

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.row_address {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
	line-height: 16px;

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.alias_block {
	padding: 0 0 0 28px;
}

.alias_label {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.alias_input {
	width: 100%;

	padding: 8px 10px;
	border: 1px solid var(--nulo-border);
	background: var(--nulo-surface-low);
	color: var(--txt-primary);
	font-size: 13px;
	font-family: inherit;
	outline: none;

	transition: border-color 0.2s ease;

	&:focus {
		border-color: var(--nulo-accent);
	}

	&::placeholder {
		color: var(--nulo-outline);
	}
}

/* ── Capability cards ──────────────────────────────────────────── */

.cap_card {
	width: 100%;

	border: 1px solid var(--nulo-border);
	background: transparent;
	overflow: hidden;

	transition: border-color 0.2s var(--bezier);
}

.cap_head {
	cursor: pointer;
	padding: 12px;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}

	&:active {
		background: var(--nulo-surface-highest);
	}
}

.cap_head_readonly {
	padding: 12px;
}

.cap_granted {
	opacity: 0.6;
}

.cap_disabled {
	cursor: default;
	pointer-events: none;
}

.checkbox_hit {
	padding: 8px;
	margin: -8px;
	cursor: pointer;
}

.denied_badge {
	padding: 1px 6px;

	font-family: var(--font-mono);
	font-size: 10px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--orange);
	background: rgba(255, 170, 0, 0.12);
	white-space: nowrap;
}

/* ── Footer ────────────────────────────────────────────────────── */

.footer {
	flex-shrink: 0;

	margin-top: auto;
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
