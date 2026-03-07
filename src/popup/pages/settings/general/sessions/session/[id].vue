<route lang="json">
{
	"meta": {
		"title": "Session",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Vendor */
import { DateTime } from "luxon"
import { onMounted } from "vue"
import { hashToEmoji } from "@aztec/wallet-sdk/crypto"

/** Components */
import Navigation from "../../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
// @ts-ignore
import EmojiGrid from "@/popup/components/modules/general/EmojiGrid.vue"
import CapabilityDetailPanel from "@/popup/components/modules/capabilities/CapabilityDetailPanel.vue"

/** Utils */
import { getChainName } from "@/components/ui/utils.js"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"
import { confirmationPolicies } from "@/utils/confirmation-policies"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()
const { loadExternalImage } = useExternalImage()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

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
	return DateTime.fromSeconds(session.value.expiry / 1_000).toFormat("LLL dd 'at' HH:mm")
})

const hasSessionAllowances = computed(() => {
	return methods.value.length > 0 || events.value.length > 0
})

const fetchSession = async () => {
	session.value = await dappSessionService.getDappSession(route.params.id)

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
	dappSessionService.deleteDappSession(session.value.id)
}

const handleCopyAddress = target => {
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
	if (ds.id !== session.value.id) return

	session.value = ds
}
function onDappSessionDeleted(ds) {
	if (ds.id !== session.value.id) return

	openToast({ label: "The session was interrupted" })
	router.go(-1)
}


onMounted(async () => {
	await fetchSession()
	await fetchAccounts()
	await fetchSessionParams()
})
</script>

<template>
	<Flex v-if="session" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="20">
			<Breadcrumbs />

			<Flex direction="column" justify="between" :class="$style.session">
				<Flex justify="between">
					<Flex align="start" justify="start">
						<Icon v-if="session.loadingLogo" :loading="true" name="dapp" size="48" color="tertiary" />
						<img
							v-else-if="session.dappMetadata.logoBlobUrl"
							:src="session.dappMetadata.logoBlobUrl"
							width="48"
							height="48"
						/>
						<Icon v-else name="dapp" size="48" color="blue" />
					</Flex>

					<Button @click="handleDropSession" type="secondary" size="mini">Disconnect</Button>
				</Flex>

				<Flex justify="between" align="end">
					<Flex direction="column" gap="6">
						<Text size="13" weight="600" color="primary">
							{{ session.dappMetadata.name ?? "Unknown dapp" }}
						</Text>
						<Text size="12" weight="600" color="tertiary" selectable>
							{{ session.dappMetadata.url }}
						</Text>
					</Flex>
				</Flex>

				<Text v-if="expiryFormatted" size="11" color="tertiary" :style="{ marginTop: '8px' }">
					Expires {{ expiryFormatted }}
				</Text>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="8" :class="$style.accounts_section">
				<Text size="15" weight="600" color="primary">Shared accounts:</Text>

				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex v-for="acc in accounts" gap="10" :class="$style.account">
						<Flex direction="column" gap="4" wide>
							<Flex align="center" justify="between" gap="12">
								<Flex direction="column" gap="4">
									<Text size="14" weight="600" color="primary">
										{{ getAccountAlias(acc) }}
									</Text>
									<Text
										v-if="getAccountAlias(acc) !== acc.name"
										size="12"
										color="tertiary"
									>
										Internal: {{ acc.name }}
									</Text>
								</Flex>

								<Tooltip>
									<NetworkBadge :chainId="acc.chainId" />

									<template #content>
										<Text size="13" color="secondary">
											{{ `aztec:${acc.chainId}` }}
										</Text>
									</template>
								</Tooltip>
							</Flex>

							<Text
								@click="handleCopyAddress(acc.address)"
								size="13"
								weight="600"
								color="tertiary"
								class="copyable"
							>
								{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>

			<Flex v-if="hasSessionAllowances" direction="column" align="start" justify="start" gap="8">
				<Text size="15" weight="600" color="primary">Session allowances:</Text>

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

			<Flex direction="column" align="start" justify="start" gap="8">
				<Text size="15" weight="600" color="primary">Confirmation policy:</Text>
				<Text size="13" color="secondary" :style="{ lineHeight: '1.2' }">
					{{
						confirmationPolicies.find(x => x.confirmationLevel === session?.confirmationLevel)
							?.description ?? "Unknown"
					}}
				</Text>
			</Flex>

			<Flex v-if="grantedCapabilities.length" direction="column" align="start" justify="start" gap="8" wide>
				<Text size="15" weight="600" color="primary">Granted capabilities:</Text>
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

			<Flex v-if="verificationEmojis" direction="column" align="start" justify="start" gap="8">
				<Text size="15" weight="600" color="primary">Connection verification:</Text>
				<Flex direction="column" align="center" wide>
					<EmojiGrid :emojis="verificationEmojis" />
				</Flex>
				<Text size="12" color="tertiary" :style="{ lineHeight: '1.2' }">
					These emojis should match what the connected app displays
				</Text>
				<Flex align="center" gap="8" :class="$style.trust_toggle" @click="toggleTrust">
					<Flex
						align="center"
						justify="center"
						:class="[$style.checkbox, isTrusted && $style.checked]"
					>
						<Icon v-if="isTrusted" name="check" size="10" color="inverse" />
					</Flex>
					<Text size="12" color="secondary">Always trust (skip verification on reconnect)</Text>
				</Flex>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 68px 24px;
}

.session {
	min-height: 120px;

	background: linear-gradient(transparent, var(--gray-3));
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);

	padding: 16px;
}

img {
	border-radius: 50%;
	transition: all 0.2s ease;
}

.trust_toggle {
	cursor: pointer;
	padding: 6px 4px;
	border-radius: 8px;
	transition: background 0.15s ease;

	&:hover {
		background: var(--gray-3);
	}
}

.checkbox {
	width: 16px;
	height: 16px;
	min-width: 16px;
	border-radius: 4px;
	border: 1.5px solid var(--gray-20);
	transition: all 0.15s ease;
}

.checked {
	background: var(--blue);
	border-color: var(--blue);
}

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 160px;
	overflow: auto;
}

.account {
	width: 100%;
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);
}

.grant_card {
	width: 100%;
	border-radius: 8px;
	overflow: hidden;
	box-shadow: inset 0 0 0 1px var(--gray-10);
}

.grant_header {
	padding: 8px 10px;
	cursor: pointer;

	transition: background 0.15s ease;

	&:hover {
		background: var(--gray-3);
	}
}
</style>
