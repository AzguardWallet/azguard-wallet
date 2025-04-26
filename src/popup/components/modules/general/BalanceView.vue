<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Components */
import ActionButtonsView from "./ActionButtonsView.vue"
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/Dropdown"

/** Utils */
import { balanceFormatted, comma } from "@/utils/amount.js"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const router = useRouter()

const props = defineProps({
	token: {
		type: Object,
		required: false,
		default: null,
	},
})

const balanceEl = useTemplateRef("balanceEl")

const tokenToDisplay = computed(() => appStore.tokens.find(t => appStore.displayOption === t.id))
const tokenBalance = computed(() => {
	if (props.token) {
		return appStore.balances.filter(Boolean).find(b => b.token?.id === props.token?.id)
	}

	return appStore.balances.filter(Boolean).find(b => b.token?.id === tokenToDisplay.value?.id)
})
const showFullBalance = ref(false)
const totalTokenBalance = computed(() => {
	if (!tokenBalance.value) return { value: 0 }

	const decimals = new BN(10).pow(tokenBalance.value?.token?.decimals || 0)
	const publicBalance = new BN(tokenBalance.value?.publicBalance || 0).dividedBy(decimals)
	const privateBalance = new BN(tokenBalance.value?.privateBalance || 0).dividedBy(decimals)

	const total = privateBalance.plus(publicBalance)

	return balanceFormatted(total, showFullBalance.value ? undefined : 20)
})

const BalanceDisplayOptionsMap = {
	total_account_value: "Account Value",
	total_private_balances: "Private Account Value",
	total_public_balances: "Public Account Value",
}

const isCopied = ref(false)
const handleCopy = (value, label) => {
	isCopied.value = true
	window.navigator.clipboard.writeText(value)
	openToast({ label: `${label} is copied`, icon: "copy" })
	setTimeout(() => {
		isCopied.value = false
	}, 2500)
}
const handleRefreshBalance = () => {
	appStore.tokensAwaitingBalanceRefresh.push(props.token.id)
	managers.balance.refreshTokenBalance(tokenBalance.value.id)
}
const isRefreshingBalance = computed(() => appStore.tokensAwaitingBalanceRefresh.includes(props.token?.id))

const handleEditToken = () => {
	cacheStore.tokenToEditIdx = props.token.id
	popupStore.open("edit_token")
}

const handleDeleteToken = () => {
	cacheStore.confirm.description =
		"Removing a token only affects the display in the UI and it does not affect the token balance"
	cacheStore.confirm.callback = async () => {
		await managers.token.deleteToken(props.token.id)
		appStore.tokens = appStore.tokens.filter(t => t.id !== props.token.id)
		appStore.balances = appStore.balances.filter(b => b.token.id !== props.token.id)

		router.push("/popup/general")
		openToast({ label: "Token successfully deleted" })
	}

	popupStore.open("confirm")
}
const handleTokenBalanceClick = async () => {
	let balance = totalTokenBalance.value?.value
	if (totalTokenBalance.value?.slashed || showFullBalance.value) {
		showFullBalance.value = !showFullBalance.value
		await nextTick()
		balance = totalTokenBalance.value?.value
	}
	
	handleCopy(balance, "Balance")
}

const dynamicFontSize = ref(2)
const calcDynamicFontSize = async () => {
	const aWidth = balanceEl.value.wrapper.getBoundingClientRect().width
	dynamicFontSize.value = Math.min(2, Math.max(0.75, (300 / aWidth) * 2))
}

watch(
	() => totalTokenBalance.value.value,
	async () => {
		if (showFullBalance.value) return

		dynamicFontSize.value = 2
		await nextTick()
		calcDynamicFontSize()
	},
)
watch(
	() => tokenToDisplay.value,
	() => {
		if (!tokenToDisplay.value) {
			if (!appStore.tokens.find(t => t.id === appStore.displayOption)) {
				appStore.displayOption = "total_account_value"
			}
		}
	},
)

onMounted(async () => {
	/** Setup balance display */
	const balanceDisplayOptionResult = await chrome.storage.local.get("azguard:ui:balanceDisplayOption")
	if ("azguard:ui:balanceDisplayOption" in balanceDisplayOptionResult) {
		const balanceDisplayOption = balanceDisplayOptionResult["azguard:ui:balanceDisplayOption"]
		appStore.displayOption = balanceDisplayOption

		if (!appStore.tokens.find(t => t.id === appStore.displayOption)) {
			appStore.displayOption = "total_account_value"
		}
	} else {
		chrome.storage.local.set({ "azguard:ui:balanceDisplayOption": "total_account_value" })
	}

	if (!totalTokenBalance.value) return

	calcDynamicFontSize()
})
</script>

<template>
	<Flex direction="column" align="center" gap="32" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="20" wide>
			<Flex justify="center" wide :class="$style.header">
				<Tooltip v-if="!token">
					<Flex @click="handleCopy(appStore.account?.address, 'Address')" align="center" gap="6" :class="[$style.badge]">
						<Text size="12" weight="600" color="secondary">
							{{ appStore.account.address.slice(0, 6) }}
							<Text color="dark">•••</Text>
							{{ appStore.account.address.slice(-4) }}
						</Text>
						<Icon
							:name="isCopied ? 'check-circle' : 'copy'"
							size="12"
							:color="isCopied ? 'green' : 'tertiary'"
						/>
					</Flex>

					<template #content> Account address </template>
				</Tooltip>

				<Flex v-else align="center" justify="between" wide>
					<Button @click="router.go(-1)" type="secondary" size="micro">
						<Icon name="arrow-right" size="12" color="secondary" style="transform: rotate(180deg)" />
					</Button>

					<Text size="12" weight="600" color="secondary" :class="$style.middle">{{ token.name }}</Text>

					<Flex align="center" gap="4">
						<Tooltip position="end" :disabled="isRefreshingBalance">
							<Button
								@click="handleRefreshBalance"
								type="secondary"
								size="micro"
								:disabled="isRefreshingBalance"
							>
								<Icon name="refresh" size="12" color="secondary" />
							</Button>

							<template #content>
								<Text color="secondary">Latest balance refresh - </Text>
								<Text>
									{{
										DateTime.fromSeconds(tokenBalance.updatedAt / 1_000).toRelative({
											locale: "en",
										})
									}}
								</Text>
							</template>
						</Tooltip>

						<Dropdown>
							<Button type="secondary" size="micro">
								<Icon name="dots" size="12" color="primary" />
							</Button>

							<template #popup>
								<DropdownItem disabled>
									<Flex align="center" gap="8">
										<Icon name="heart-add" size="14" color="primary" />
										Add to Favorites
									</Flex>
								</DropdownItem>
								<DropdownDivider />
								<DropdownItem @click="handleCopy(props.token?.contract, 'Token address')">
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
								<DropdownDivider />
								<DropdownItem disabled>
									<Flex align="center" gap="8">
										<Icon name="arrow-narrow-up-right" size="14" color="tertiary" />
										<Text size="12" weight="600" color="tertiary">Learn about tokens </Text>
									</Flex>
								</DropdownItem>
							</template>
						</Dropdown>
					</Flex>
				</Flex>
			</Flex>

			<Flex direction="column" gap="12" align="center">
				<Flex
					v-if="!props.token"
					@click="popupStore.open('select_balance_type')"
					align="center"
					gap="4"
					:class="$style.balance_type"
				>
					<Icon
						:name="appStore.displayOption in BalanceDisplayOptionsMap ? 'dollar' : 'banknote'"
						size="14"
						color="tertiary"
					/>
					<Text size="12" weight="600" color="secondary">
						<template v-if="appStore.displayOption in BalanceDisplayOptionsMap">
							{{ BalanceDisplayOptionsMap[appStore.displayOption] }}
						</template>
						<template v-else> {{ tokenToDisplay.symbol }} Balance </template>
					</Text>
					<Icon name="chevron" size="12" color="support" />
				</Flex>
				<Flex v-else align="center" gap="4">
					<Icon name="banknote" color="tertiary" size="14" />
					<Text size="12" weight="600" color="secondary"> {{ token.symbol }} Balance </Text>
				</Flex>

				<Flex
					@click="appStore.isPrivacyModeEnabled = !appStore.isPrivacyModeEnabled"
					justify="center"
					:class="$style.balance"
				>
					<Tooltip :disabled="!!token">
						<Flex align="center" gap="8" ref="balanceEl">
							<Text v-if="!token && !tokenToDisplay" size="32" weight="500" height="100" color="tertiary">
								$0.00
							</Text>
							<Text
								v-else
								@click="handleTokenBalanceClick"
								weight="500"
								height="100"
								color="primary"
								tabular
								:style="{ fontSize: `${dynamicFontSize}rem` }"
								:class="[$style.amount_wrapper, showFullBalance && $style.amount_wrapper_full, isRefreshingBalance && $style.refreshing]"
							>
								{{ totalTokenBalance.value }}
								<Text color="tertiary">{{ token?.symbol || tokenToDisplay.symbol }}</Text>
							</Text>
						</Flex>

						<template #content>
							Price quotes to calculate the total value of your wallet are planned in the next updates
						</template>
					</Tooltip>
				</Flex>
			</Flex>
		</Flex>

		<ActionButtonsView :token />
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	margin: 0 24px;
	padding: 20px 0 16px 0;
}

.header {
	position: relative;

	min-height: 20px;
}

.middle {
	max-width: 180px;
	position: absolute;
	left: 50%;
	transform: translateX(-50%);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.balance {
	cursor: pointer;
}

@keyframes blink {
	0% {
		opacity: 1;
	}

	20% {
		opacity: 0.2;
	}

	50% {
		opacity: 0.5;
	}

	80% {
		opacity: 0.2;
	}

	100% {
		opacity: 1;
	}
}

.amount_wrapper {
	white-space: nowrap;

	opacity: 1;

	/* transition: all 0.2s ease; */

	&.refreshing {
		animation: blink 2s linear infinite;
	}
}

.amount_wrapper_full {
	white-space: wrap;
	word-break: break-word;

	line-height: 1.4;

	opacity: 1;

	/* transition: all 0.2s ease; */

	&.refreshing {
		animation: blink 2s linear infinite;
	}
}

.wallet_name {
	max-width: 100px;

	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.badge {
	border-radius: 8px;
	background: var(--gray-5);
	cursor: pointer;

	padding: 4px 8px;

	transition: all 0.2s ease;

	&:hover {
		background: var(--gray-10);
	}
}

.warning_icon {
	position: absolute;
	right: -26px;
}

.balance_type {
	cursor: pointer;

	& svg,
	& span {
		transition: all 0.2s var(--bezier);
	}

	&:hover {
		& svg,
		& span {
			fill: var(--txt-primary);
			color: var(--txt-primary);
		}
	}
}

.hover_red {
	& svg,
	& span {
		transition: all 0.2s var(--bezier);
	}

	&:hover {
		svg {
			fill: var(--red);
		}

		span {
			color: var(--red);
		}
	}
}
</style>
