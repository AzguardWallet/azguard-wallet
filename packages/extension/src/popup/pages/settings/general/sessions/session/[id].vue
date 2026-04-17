<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"
import CapabilityDetailPanel from "@/popup/components/modules/capabilities/CapabilityDetailPanel.vue"
import EmojiGrid from "@/popup/components/modules/general/EmojiGrid.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Vendor */
import { DateTime } from "luxon"
import { hashToEmoji } from "@aztec/wallet-sdk/crypto"

/** Services */
import { AccountServiceClient } from "@/wallet/services/account/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()
const { loadExternalImage } = useExternalImage()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const route = useRoute()
const router = useRouter()

const session = ref()
const accounts = ref([])
const chains = ref([])
const methods = ref([])
const events = ref([])

const verificationEmojis = computed(() => {
	if (session.value?.verificationHash) {
		return hashToEmoji(session.value.verificationHash)
	}
	return ""
})

const expiryFormatted = computed(() => {
	if (!session.value?.expiry) return ""
	return DateTime.fromMillis(session.value.expiry).toFormat("LLL dd 'at' HH:mm")
})

const hasSessionAllowances = computed(() => {
	return methods.value.length > 0 || events.value.length > 0
})

const fetchSession = async () => {
	try {
		session.value = await dappSessionService.getDappSession(route.params.id)
	} catch {
		// Session missing / expired — the service throws instead of returning null
		router.push("/popup/settings/general/sessions")
		return
	}

	if (!session.value) {
		router.push("/popup/settings/general/sessions")
		return
	}

	if (session.value.dappMetadata.logo) {
		session.value.loadingLogo = true
		try {
			session.value.dappMetadata.logoBlobUrl = await loadExternalImage(session.value.dappMetadata.logo)
		} finally {
			session.value.loadingLogo = false
		}
	}
}

async function fetchAccounts() {
	const networkServiceClient = new NetworkServiceClient()
	const accMap = new Map()

	for (const account of session.value.accounts) {
		const [_, chainId, address] = account.split(":")
		if (!accMap[chainId]) {
			accMap[chainId] = []
		}
		accMap[chainId].push(address)
	}

	for (const chainId of Object.keys(accMap)) {
		const networks = await networkServiceClient.getNetworks(+chainId)
		if (networks.length) {
			const network = networks[0]
			const accountServiceClient = new AccountServiceClient()

			for (const address of accMap[chainId]) {
				const account = await accountServiceClient.getAccount(appStore.profile.id, network.chainId, address)
				if (account) {
					accounts.value.push(account)
				}
			}
		}
	}
}

async function fetchSessionParams() {
	for (const p of session.value.permissions) {
		chains.value = [...chains.value, ...(p.chains ?? [])]
		methods.value = [...methods.value, ...(p.methods ?? [])]
		events.value = [...events.value, ...(p.events ?? [])]
	}

	chains.value = [...new Set(chains.value)]
	methods.value = [...new Set(methods.value)]
	events.value = [...new Set(events.value)]
}

const handleDropSession = () => {
	if (!session.value) return
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, disconnect"
	cacheStore.confirm.description = `Disconnect "${session.value.dappMetadata?.name ?? "this dApp"}"?`
	cacheStore.confirm.callback = async () => {
		await dappSessionService.deleteDappSession(session.value.id)
	}
	popupStore.open("confirm")
}

const handleCopyAddress = (target) => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })
}

const getAccountAlias = (acc) => {
	if (!session.value?.accountAliases) return acc.name
	const caip = `aztec:${acc.chainId}:${acc.address}`
	return session.value.accountAliases[caip] || acc.name
}

const CAPABILITY_LABELS = {
	accounts: "Share accounts",
	contracts: "Register and query contracts",
	contractClasses: "Query contract classes",
	simulation: "Simulate transactions",
	transaction: "Send transactions",
	data: "Access private data",
}

const getCapabilityLabel = (type) => {
	return CAPABILITY_LABELS[type] ?? type
}

const grantedCapabilities = computed(() => {
	return session.value?.capabilityGrants ?? []
})

const expandedGrants = ref(new Set())

const toggleGrantExpand = (index) => {
	if (expandedGrants.value.has(index)) {
		expandedGrants.value.delete(index)
	} else {
		expandedGrants.value.add(index)
	}
}

const isGrantExpanded = (index) => expandedGrants.value.has(index)

const isTrusted = computed(() => session.value?.trustedVerification ?? false)

const toggleTrust = async () => {
	if (!session.value) return
	await dappSessionService.setTrustedVerification(session.value.id, !isTrusted.value)
}

const dappSessionService = new DappSessionServiceClient()
dappSessionService.onDappSessionUpdated.add(onDappSessionUpdated)
dappSessionService.onDappSessionDeleted.add(onDappSessionDeleted)
function onDappSessionUpdated(ds) {
	if (ds.id !== session.value?.id) return

	// Preserve already-loaded logoBlobUrl across updates
	const prevBlob = session.value.dappMetadata?.logoBlobUrl
	session.value = ds
	if (prevBlob && session.value.dappMetadata) {
		session.value.dappMetadata.logoBlobUrl = prevBlob
	}
}
function onDappSessionDeleted(ds) {
	if (ds.id !== session.value?.id) return

	openToast({ label: "The session was interrupted" })
	router.go(-1)
}

onMounted(async () => {
	await fetchSession()
	if (!session.value) return
	await fetchAccounts()
	await fetchSessionParams()
})

onBeforeUnmount(() => {
	dappSessionService.disconnect()
})
</script>

<template>
	<Flex v-if="session" direction="column" :class="$style.wrapper">
		<SubPageHeader title="Session" leadingIcon="extension" :backTo="'/popup/settings/general/sessions'">
			<template #trailing>
				<Dropdown>
					<button type="button" :class="$style.icon_btn" aria-label="Session actions">
						<MaterialIcon name="more_vert" :size="18" color="secondary" />
					</button>

					<template #popup>
						<DropdownItem @click="handleDropSession">
							<Flex align="center" gap="8">
								<Icon name="log-out" size="14" color="secondary" />
								Disconnect session
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</template>
		</SubPageHeader>

		<Flex direction="column" gap="24" :class="$style.content">
			<!-- Identity block -->
			<Flex align="center" gap="12" wide>
				<Icon v-if="session.loadingLogo" :loading="true" name="dapp" size="40" color="tertiary" />
				<img
					v-else-if="session.dappMetadata.logoBlobUrl"
					:src="session.dappMetadata.logoBlobUrl"
					:class="$style.logo"
					alt=""
				/>
				<Icon v-else name="dapp" size="40" color="tertiary" />

				<Flex direction="column" gap="4" wide>
					<Text size="14" weight="600" color="primary">
						{{ session.dappMetadata.name ?? "Unknown dapp" }}
					</Text>
					<Text size="12" weight="500" color="tertiary" selectable>
						{{ session.dappMetadata.url }}
					</Text>
					<Text v-if="expiryFormatted" size="11" color="tertiary">
						Expires {{ expiryFormatted }}
					</Text>
				</Flex>
			</Flex>

			<!-- Shared accounts -->
			<Flex direction="column" gap="8" wide>
				<Text size="13" weight="600" color="primary">
					Shared accounts&nbsp;<Text color="tertiary">{{ accounts.length }}</Text>
				</Text>

				<ItemsContainer v-if="accounts.length">
					<SettingItem
						v-for="acc in accounts"
						:key="`${acc.chainId}:${acc.address}`"
						materialIcon="account_balance_wallet"
						:title="getAccountAlias(acc)"
						:description="`${acc.address.slice(0, 6)}...${acc.address.slice(-4)}`"
						raw
					>
						<template #right>
							<Flex align="center" gap="8">
								<Tooltip position="end" delay="350">
									<Icon
										@click.stop="handleCopyAddress(acc.address)"
										name="copy"
										size="14"
										color="tertiary"
										:class="$style.action_icon"
									/>

									<template #content> Copy address </template>
								</Tooltip>
								<NetworkBadge :chainId="acc.chainId" />
							</Flex>
						</template>
					</SettingItem>
				</ItemsContainer>
			</Flex>

			<!-- Session allowances -->
			<Flex v-if="hasSessionAllowances" direction="column" gap="8" wide>
				<Text size="13" weight="600" color="primary">Session allowances</Text>

				<Flex align="start" gap="4">
					<Text size="13" weight="600" color="secondary">Networks:</Text>
					<Text size="13" color="secondary" :style="{ lineHeight: '1.2' }">
						{{ chains.map(ch => getChainName(Number(ch.split(":").pop()))).join(", ") }}
					</Text>
				</Flex>

				<Flex align="start" gap="4">
					<Text size="13" weight="600" color="secondary">Methods:</Text>
					<Text size="13" color="secondary" :style="{ lineHeight: '1.2' }"> {{ methods.join(", ") }} </Text>
				</Flex>

				<Flex align="start" gap="4">
					<Text size="13" weight="600" color="secondary">Events:</Text>
					<Text v-if="events.length" size="13" color="secondary" :style="{ lineHeight: '1.2' }">
						{{ events.join(", ") }}
					</Text>
					<Text v-else size="13" color="tertiary" :style="{ lineHeight: '1.2' }"> no allowances given </Text>
				</Flex>
			</Flex>

			<!-- Confirmation policy -->
			<Flex direction="column" gap="8" wide>
				<Text size="13" weight="600" color="primary">Confirmation policy</Text>
				<Text size="13" color="secondary" :style="{ lineHeight: '1.4' }">
					{{
						confirmationPolicies.find(x => x.confirmationLevel === session?.confirmationLevel)
							?.description ?? "Unknown"
					}}
				</Text>
			</Flex>

			<!-- Granted capabilities -->
			<Flex v-if="grantedCapabilities.length" direction="column" gap="8" wide>
				<Text size="13" weight="600" color="primary">
					Granted capabilities&nbsp;<Text color="tertiary">{{ grantedCapabilities.length }}</Text>
				</Text>
				<Flex direction="column" gap="6" wide>
					<Flex
						v-for="(grant, gi) in grantedCapabilities"
						:key="grant.capability.type"
						direction="column"
						:class="$style.grant_card"
					>
						<Flex
							@click="toggleGrantExpand(gi)"
							align="center"
							justify="between"
							:class="$style.grant_header"
						>
							<Flex align="center" gap="6">
								<Icon name="check-circle" size="11" color="green" />
								<Text size="13" color="secondary">{{ getCapabilityLabel(grant.capability.type) }}</Text>
							</Flex>
							<Icon
								name="chevron"
								size="12"
								color="tertiary"
								:style="{ transform: isGrantExpanded(gi) ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }"
							/>
						</Flex>
						<CapabilityDetailPanel
							v-if="isGrantExpanded(gi)"
							:capability="grant.capability"
							:granted="true"
						/>
					</Flex>
				</Flex>
			</Flex>

			<!-- Connection verification -->
			<Flex v-if="verificationEmojis" direction="column" gap="8" wide>
				<Text size="13" weight="600" color="primary">Connection verification</Text>
				<Flex direction="column" align="center" wide>
					<EmojiGrid :emojis="verificationEmojis" />
				</Flex>
				<Text size="12" color="tertiary" :style="{ lineHeight: '1.4' }">
					These emojis should match what the connected app displays
				</Text>
				<Flex align="center" justify="between" gap="12" wide>
					<Flex direction="column" gap="6">
						<Text size="13" weight="600" color="primary">Always trust</Text>
						<Text size="12" weight="500" color="tertiary">Skip verification on reconnect</Text>
					</Flex>
					<Toggle :modelValue="isTrusted" @update:modelValue="toggleTrust" />
				</Flex>
			</Flex>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	scrollbar-gutter: stable;
	background: var(--app-bg);
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.logo {
	width: 40px;
	height: 40px;
	object-fit: cover;
	flex-shrink: 0;
}

.icon_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 32px;
	height: 32px;

	background: transparent;
	border: none;
	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: rgba(248, 241, 231, 0.08);
	}
}

.action_icon {
	cursor: pointer;
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}

.grant_card {
	width: 100%;
	overflow: hidden;
	border: 1px solid var(--nulo-border);
}

.grant_header {
	padding: 10px 12px;
	cursor: pointer;

	transition: background 0.15s ease;

	&:hover {
		background: var(--nulo-surface-high);
	}
}
</style>
