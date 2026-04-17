<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import BalanceView from "../../components/modules/general/BalanceView.vue"
import Navigation from "../../components/Navigation.vue"
import RecentActivityView from "../../components/modules/general/RecentActivityView.vue"
import SplittedBalancesView from "../../components/modules/general/SplittedBalancesView.vue"
import SubPageHeader from "@/components/ui/SubPageHeader.vue"
import { Dropdown } from "@/components/ui/Dropdown"

/** Vendor */
import { DateTime } from "luxon"

/** Services */
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const route = useRoute()
const router = useRouter()

const token = ref()
const tokenBalance = ref()
const isRefreshingBalance = ref(false)

const tokenService = new TokenServiceClient()
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenDeleted(t) {
	if (t.id === token.value?.id) {
		router.push("/popup/general")
	}
}

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)
function onBalanceUpdated(tb) {
	if (tb.id !== tokenBalance.value?.id) return
	tokenBalance.value = tb
}

watch(
	() => token.value,
	async () => {
		if (token.value) {
			cacheStore.activeTokenIdx = token.value?.id
			tokenBalance.value = (await tokenBalanceService.getTokenBalances(token.value.id, appStore.account.address))?.at(0)
		}
	},
)

watch(
	() => appStore.account,
	async () => {
		tokenBalance.value = (await tokenBalanceService.getTokenBalances(token.value.id, appStore.account.address))?.at(0)
		if (!tokenBalance.value) {
			cacheStore.activeTokenIdx = null
			router.push("/popup/general")
		}
	},
)

/** Trailing actions */
const handleRefreshBalance = () => {
	if (!tokenBalance.value?.id) return
	tokenBalanceService.refreshTokenBalance(tokenBalance.value.id)
}

const handleCopy = (value, label) => {
	window.navigator.clipboard.writeText(value)
	openToast({ label: `${label} is copied`, icon: "copy" })
}

const handleEditToken = () => {
	cacheStore.tokenToEditIdx = token.value.id
	popupStore.open("edit_token")
}

const handleDeleteToken = () => {
	cacheStore.confirm.description = "Removing a token only affects the display in the UI and it does not affect the token balance"
	cacheStore.confirm.callback = async () => {
		await tokenService.deleteToken(token.value.id)
		router.push("/popup/general")
		openToast({ label: "Token successfully deleted" })
	}
	popupStore.open("confirm")
}

onMounted(async () => {
	token.value = await tokenService.getToken(route.params.id)
	if (!token.value) {
		router.push("/popup/general")
	}
})

onBeforeUnmount(() => {
	tokenService.disconnect()
	tokenBalanceService.disconnect()
	cacheStore.activeTokenIdx = null
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<SubPageHeader
			:title="token?.symbol || ''"
			:backTo="'/popup/general'"
			leadingIcon="account_balance_wallet"
		>
			<template #trailing>
				<Tooltip position="end" :disabled="isRefreshingBalance || !tokenBalance?.updatedAt">
					<button
						@click="handleRefreshBalance"
						type="button"
						:disabled="isRefreshingBalance"
						:class="$style.icon_btn"
						aria-label="Refresh balance"
					>
						<MaterialIcon name="refresh" :size="18" color="secondary" />
					</button>

					<template #content>
						<Text color="secondary">Latest balance refresh - </Text>
						<Text>{{ DateTime.fromSeconds(tokenBalance?.updatedAt / 1_000).toRelative({ locale: "en" }) }}</Text>
					</template>
				</Tooltip>

				<Dropdown>
					<button type="button" :class="$style.icon_btn" aria-label="Token actions">
						<MaterialIcon name="more_vert" :size="18" color="secondary" />
					</button>

					<template #popup>
						<DropdownItem @click="handleCopy(token?.contract, 'Token address')">
							<Flex align="center" gap="8">
								<Icon name="copy" size="14" color="primary" />
								Copy address
							</Flex>
						</DropdownItem>
						<DropdownItem @click="popupStore.open('token_metadata')">
							<Flex align="center" gap="8">
								<Icon name="code-circle" size="14" color="primary" />
								Show metadata
							</Flex>
						</DropdownItem>
						<DropdownDivider />
						<DropdownItem @click="handleEditToken">
							<Flex align="center" gap="8">
								<Icon name="edit" size="14" color="primary" />
								Edit token
							</Flex>
						</DropdownItem>
						<DropdownItem @click="handleDeleteToken" :class="$style.hover_red">
							<Flex align="center" gap="8">
								<Icon name="trash" size="14" color="primary" />
								<Text>Remove token</Text>
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</template>
		</SubPageHeader>

		<BalanceView :tokenBalance />

		<Flex direction="column" justify="between" :class="$style.content">
			<Flex direction="column" gap="32">
				<Banner v-if="!token?.hasPublicTransfers && !token?.hasPrivateTransfers" variant="warning">
					Private and public transfers disabled
				</Banner>

				<SplittedBalancesView :tokenBalance />

				<RecentActivityView :token />
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
}

.content {
	flex: 1;
	padding: 24px 24px 96px 24px;
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

	&:disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}

.hover_red {
	& svg,
	& span {
		transition: all 0.2s var(--bezier);
	}

	&:hover {
		svg { fill: var(--red); }
		span { color: var(--red); }
	}
}
</style>
