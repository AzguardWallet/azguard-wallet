<script setup lang="ts">
/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Components */
// @ts-ignore
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import CapabilityDetailPanel from "@/popup/components/modules/capabilities/CapabilityDetailPanel.vue"

/** Utils */
import { getErrorData } from "@/wallet/utils/errors"

/** Services */
import { ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import { DappMetadata } from "@/wallet/services/dapp-session/client"
import {
	CapabilityPayload,
	DappInteractionServiceClient,
} from "@/wallet/services/dapp-interaction/client"

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
	capability: any
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
// @ts-ignore
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
	contracts: { label: "Register and query contracts", description: "Register contract instances and read contract metadata", risk: "low" },
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
		const hasAccountsInDelta = payload.value.params.delta.some((cap: any) => cap.type === "accounts")
		if (hasAccountsInDelta && payload.value.params.availableAccounts?.length) {
			needsAccountSelection.value = true
			availableAccounts.value = payload.value.params.availableAccounts
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
	const index = selectedAccounts.value.findIndex(acc => acc.address === account.address)
	if (index < 0) {
		selectedAccounts.value.push(account)
	} else {
		selectedAccounts.value.splice(index, 1)
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
	// Validate account selection if needed
	if (needsAccountSelection.value && selectedAccounts.value.length === 0) {
		setError(
			"Select at least one account",
			"You must select at least one account to share with the dApp",
			"warning",
		)
		return
	}
	try {
		isLoading.value = true
		const approvedNew = capabilities.value
			.filter(c => c.isNew && c.selected)
			.map(c => c.capability)
		const existing = capabilities.value
			.filter(c => !c.isNew)
			.map(c => c.capability)

		// Re-add the accounts capability to granted if accounts were selected
		const granted = [...approvedNew, ...existing]
		if (needsAccountSelection.value && selectedAccounts.value.length > 0) {
			const accountsCap = payload.value!.params.delta.find((cap: any) => cap.type === "accounts")
			if (accountsCap) {
				granted.push(accountsCap)
			}
		}

		// Build account result
		let resultSelectedAccounts: string[] | undefined
		let resultAliases: Record<string, string> | undefined
		if (needsAccountSelection.value && selectedAccounts.value.length > 0) {
			resultSelectedAccounts = selectedAccounts.value.map(
				acc => `aztec:${acc.chainId}:${acc.address}`,
			)
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
	interactionService.rejectInteraction(requestId.value!, "User rejected")
	closeWindow(true)
}

const closeWindow = (interactionCompleted?: boolean) => {
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

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

onMounted(async () => {
	profileService.connect()
	interactionService.connect()

	if (!appStore.isSessionChecked) {
		await new Promise<void>((resolve) => {
			const stop = watch(() => appStore.isSessionChecked, (checked) => {
				if (checked) { stop(); resolve() }
			}, { immediate: true })
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
				<Text size="16" weight="600" color="primary">Capability request</Text>
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

					<Text size="13" weight="600" color="primary">Azguard Wallet</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{ marginTop: '-4px' }">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
					<Text size="13" color="primary">The dApp is requesting access</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">Review what this dApp can do with your wallet</Text>
				</Flex>
			</Flex>

			<!-- Account selection section -->
			<Flex
				v-if="needsAccountSelection"
				direction="column"
				align="start"
				justify="start"
				gap="8"
				:class="$style.accounts_section"
			>
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="15" weight="600" color="primary">Select accounts to share</Text>
					<Text size="12" color="secondary">Choose which accounts this dApp can see</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex
						v-for="acc in availableAccounts"
						:key="acc.address"
						direction="column"
						gap="8"
						:class="[$style.account, (isLoading || processingError?.type === 'error') && $style.disabled]"
					>
						<Flex @click="selectAccount(acc)" gap="10" style="cursor: pointer">
							<Flex align="center">
								<Icon
									v-if="selectedAccounts.find(a => a.address === acc.address)"
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
						<Flex
							v-if="selectedAccounts.find(a => a.address === acc.address)"
							direction="column"
							gap="4"
							wide
						>
							<Flex align="center" gap="4">
								<Text size="12" weight="600" color="secondary">Alias</Text>
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
					</Flex>
				</Flex>
			</Flex>

			<!-- New capabilities (delta) — accounts type excluded, shown as section above -->
			<Flex
				v-if="capabilities.filter(c => c.isNew).length"
				direction="column"
				align="start"
				justify="start"
				gap="8"
				:class="$style.section"
			>
				<Text size="15" weight="600" color="primary">New capabilities requested:</Text>
				<Flex direction="column" gap="6" wide>
					<Flex
						v-for="(cap, i) in capabilities"
						v-show="cap.isNew"
						:key="`new-${i}`"
						direction="column"
						:class="[$style.capability_card_wrapper, (isLoading || processingError?.type === 'error') && $style.disabled]"
					>
						<Flex
							@click="toggleExpand(i)"
							gap="10"
							:class="$style.capability_card"
						>
							<Flex align="center" @click.stop="toggleCapability(i)" :class="$style.checkbox_hit">
								<Icon
									v-if="cap.selected"
									name="check-circle"
									size="16"
									color="green"
								/>
								<Icon v-else name="circle" size="16" color="secondary" />
							</Flex>

							<Flex direction="column" gap="2" wide>
								<Flex align="center" justify="between" gap="8">
									<Flex align="center" gap="6">
										<Text size="14" weight="600" color="primary">{{ cap.label }}</Text>
										<Text
											v-if="cap.reRequested"
											size="10"
											weight="600"
											color="yellow"
											:class="$style.denied_badge"
										>
											previously denied
										</Text>
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
								<Text size="12" color="secondary" :style="{ lineHeight: '1.2' }">
									{{ cap.description }}
								</Text>
							</Flex>
						</Flex>

						<CapabilityDetailPanel
							v-if="isExpanded(i)"
							:capability="cap.capability"
							:granted="false"
						/>
					</Flex>
				</Flex>
			</Flex>

			<!-- Already granted capabilities -->
			<Flex
				v-if="capabilities.filter(c => !c.isNew).length"
				direction="column"
				align="start"
				justify="start"
				gap="8"
				:class="$style.section"
			>
				<Text size="15" weight="600" color="primary">Already granted:</Text>
				<Flex direction="column" gap="6" wide>
					<Flex
						v-for="(cap, i) in capabilities"
						v-show="!cap.isNew"
						:key="`existing-${i}`"
						direction="column"
						:class="[$style.capability_card_wrapper, $style.granted]"
					>
						<Flex
							gap="10"
							:class="$style.capability_card"
						>
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
								<Text size="12" color="tertiary" :style="{ lineHeight: '1.2' }">
									{{ cap.description }}
								</Text>
							</Flex>
						</Flex>

						<CapabilityDetailPanel
							v-if="isExpanded(i)"
							:capability="cap.capability"
							:granted="true"
						/>
					</Flex>
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

.section {
	width: 100%;
}

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 172px;
	overflow: auto;
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

.alias_input {
	width: 100%;
	padding: 6px 10px;
	border-radius: 8px;
	border: 1px solid var(--gray-10);
	background: var(--gray-3);
	color: var(--txt-primary);
	font-size: 13px;
	font-family: inherit;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: var(--blue);
	}

	&::placeholder {
		color: var(--txt-tertiary);
	}
}

.capability_card_wrapper {
	width: 100%;
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);
	overflow: hidden;

	transition: all 0.2s var(--bezier);
}

.capability_card {
	cursor: pointer;
	padding: 12px;

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.granted {
	opacity: 0.6;

	& .capability_card {
		cursor: default;

		&:hover {
			background: transparent;
		}

		&:active {
			background: transparent;
		}
	}
}

.checkbox_hit {
	padding: 8px;
	margin: -8px;
	cursor: pointer;
}

.denied_badge {
	padding: 1px 6px;
	border-radius: 4px;
	background: rgba(255, 170, 0, 0.12);
	white-space: nowrap;
}

.disabled {
	cursor: default;
	pointer-events: none;
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
