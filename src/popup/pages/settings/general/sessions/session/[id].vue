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

/** Components */
import Navigation from "../../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { getChainName } from "@/components/ui/utils.js"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"

/** Composables */
import { useToast } from "@/composables/toast.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const { openToast } = useToast()

const route = useRoute()
const router = useRouter()

const session = ref()
const accounts = ref([])
const chains = ref([])
const methods = ref([])
const events = ref([])

const fetchSession = async () => {
	const id = route.params.id

	session.value = await dappSessionServiceClient.getDappSession(id)

	if (!session.value) {
		router.push("/popup/settings/general/sessions")
		return
	}

	session.value.imageLoaded = !!session.value.dappMetadata.logo
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
			const accountServiceClient = new AccountServiceClient(appStore.profile, network)

			for (const address of accMap[chainId]) {
				const account = await accountServiceClient.getAccount(address)
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

const onImageError = () => {
	session.value.imageLoaded = false
}

const handleDropSession = () => {
	dappSessionServiceClient.deleteDappSession(session.value.id)
	router.push("/popup/settings/general/sessions")
}

const handleCopyAddress = target => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })
}

const dappSessionServiceClient = new DappSessionServiceClient()

onMounted(async () => {
	await fetchSession()
	await fetchAccounts()
	await fetchSessionParams()
})
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="20">
			<Breadcrumbs />

			<Flex direction="column" justify="between" :class="$style.session">
				<Flex justify="between">
					<Flex align="start" justify="start">
						<img
							v-if="session?.imageLoaded"
							:src="session?.dappMetadata.logo"
							@error="onImageError()"
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
							{{ session?.dappMetadata.name ?? "Unknown dapp" }}
						</Text>
						<Text size="12" weight="600" color="tertiary" selectable>
							{{ session?.dappMetadata.url }}
						</Text>
					</Flex>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="8" :class="$style.accounts_section">
				<Text size="15" weight="600" color="primary">Shared accounts:</Text>

				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex v-for="acc in accounts" gap="10" :class="$style.account">
						<Flex direction="column" gap="4" wide>
							<Flex align="center" justify="between" gap="12">
								<Text size="14" weight="600" color="primary">
									{{ acc.name }}
								</Text>

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

			<Flex direction="column" align="start" justify="start" gap="8">
				<Text size="15" weight="600" color="primary">Session allowances:</Text>

				<Flex align="start" gap="4" :style="{ paddingLeft: '4px' }">
					<Text size="13" weight="600" color="secondary">Networks:</Text>
					<Text size="13" color="secondary" :style="{ lineHeight: '1.2' }">
						{{ chains.map(ch => getChainName(Number(ch.split(":").pop()))).join(", ") }}
					</Text>
				</Flex>

				<Flex align="start" gap="4" :style="{ paddingLeft: '4px' }">
					<Text size="13" weight="600" color="secondary">Methods:</Text>
					<Text size="13" color="secondary" :style="{ lineHeight: '1.2' }"> {{ methods.join(", ") }} </Text>
				</Flex>

				<Flex align="start" gap="4" :style="{ paddingLeft: '4px' }">
					<Text size="13" weight="600" color="secondary">Events:</Text>
					<Text v-if="events.length" size="13" color="secondary" :style="{ lineHeight: '1.2' }"> {{ events.join(", ") }} </Text>
					<Text v-else size="13" color="tertiary" :style="{ lineHeight: '1.2' }"> no allowances given </Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex align="end" justify="end">
			<Text size="12" weight="500" color="tertiary">
				{{ DateTime.fromSeconds(session?.expiry / 1_000).toFormat("'Expires' LLL dd 'at' HH:mm") }}
			</Text>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

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
</style>
