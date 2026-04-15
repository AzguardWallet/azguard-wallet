<script setup>
/** Components */
import ActionButtonsView from "./ActionButtonsView.vue"
import GasBalanceCard from "./GasBalanceCard.vue"
import { Dropdown } from "@/components/ui/Dropdown"

/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { ContentKind } from "@/wallet/services/task/spec"
import { TaskServiceClient } from "@/wallet/services/task/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"

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
	tokenBalance: {
		type: Object,
		required: false,
		default: null,
	},
})

const balanceEl = useTemplateRef("balanceEl")

const tokenBalances = ref([])

const tokenToDisplay = computed(
	() => props.tokenBalance?.token || tokenBalances.value.find((tb) => tb.token.id === appStore.displayOption)?.token,
)
const tokenBalanceToDisplay = computed(() => {
	return props.tokenBalance || tokenBalances.value.find((tb) => tb.token.id === tokenToDisplay.value?.id)
})
const showFullBalance = ref(false)
const totalTokenBalance = computed(() => {
	if (!tokenBalanceToDisplay.value) return { value: 0 }

	const decimals = new BN(10).pow(tokenBalanceToDisplay.value?.token?.decimals || 0)
	const publicBalance = new BN(tokenBalanceToDisplay.value?.publicBalance || 0).dividedBy(decimals)
	const privateBalance = new BN(tokenBalanceToDisplay.value?.privateBalance || 0).dividedBy(decimals)

	const total = privateBalance.plus(publicBalance)

	return balanceFormatted(total, showFullBalance.value ? undefined : 20)
})

const privateBalanceFormatted = computed(() => {
	if (!tokenBalanceToDisplay.value) return "0"
	const decimals = new BN(10).pow(tokenBalanceToDisplay.value?.token?.decimals || 0)
	const balance = new BN(tokenBalanceToDisplay.value?.privateBalance || 0).dividedBy(decimals)
	return balanceFormatted(balance, 10).value
})
const publicBalanceFormatted = computed(() => {
	if (!tokenBalanceToDisplay.value) return "0"
	const decimals = new BN(10).pow(tokenBalanceToDisplay.value?.token?.decimals || 0)
	const balance = new BN(tokenBalanceToDisplay.value?.publicBalance || 0).dividedBy(decimals)
	return balanceFormatted(balance, 10).value
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
	tokenBalanceService.refreshTokenBalance(tokenBalanceToDisplay.value?.id)
}
const isRefreshingBalance = ref(false)

const handleEditToken = () => {
	cacheStore.tokenToEditIdx = tokenToDisplay.value.id
	popupStore.open("edit_token")
}

const handleDeleteToken = () => {
	cacheStore.confirm.description = "Removing a token only affects the display in the UI and it does not affect the token balance"
	cacheStore.confirm.callback = async () => {
		await tokenService.deleteToken(tokenToDisplay.value.id)

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

const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onTaskCreated)
taskService.onTaskUpdated.add(onTaskUpdated)
taskService.onTaskDeleted.add(onTaskDeleted)
function onTaskCreated(task) {
	switch (task.content.kind) {
		case ContentKind.BalanceUpdate:
			if (tokenBalanceToDisplay.value?.id !== task.content.tbId) return

			isRefreshingBalance.value = true

			break

		default:
			break
	}
}
function onTaskUpdated(task) {
	switch (task.content.kind) {
		case ContentKind.BalanceUpdate:
			if (!task.finishedAt) return
			if (tokenBalanceToDisplay.value?.id !== task.content.tbId) return

			isRefreshingBalance.value = false

			break

		default:
			break
	}
}
function onTaskDeleted(task) {
	switch (task.content.kind) {
		case ContentKind.BalanceUpdate:
			if (tokenBalanceToDisplay.value?.id !== task.content.tbId) return

			isRefreshingBalance.value = false

			break

		default:
			break
	}
}

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)
tokenBalanceService.onTokenBalanceDeleted.add(onBalanceDeleted)
function onBalanceAdded(tb) {
	if (tb.account !== appStore.account.address) return

	tokenBalances.value.push(tb)
}
function onBalanceUpdated(tb) {
	const idx = tokenBalances.value.findIndex((_tb) => _tb.id === tb.id)
	if (idx !== -1) {
		tokenBalances.value[idx] = tb
	}
}
function onBalanceDeleted(tb) {
	if (!props.tokenBalance && tokenToDisplay.value?.id === tb.token.id) {
		appStore.displayOption = "total_account_value"
	}
}

const tokenService = new TokenServiceClient()
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenDeleted(token) {
	if (!props.tokenBalance && tokenToDisplay.value?.id === token.id) {
		appStore.displayOption = "total_account_value"
	}
}

async function fetchTokenBalances() {
	tokenBalances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account?.address)
	isRefreshingBalance.value = (await taskService.getTasks()).some(
		(t) =>
			!t.finishedAt &&
			t.content.kind === ContentKind.BalanceUpdate &&
			t.content.account === appStore.account.address &&
			t.content.tbId === tokenBalanceToDisplay.value?.id,
	)
}

async function loadBalanceDisplayOptionMigration(profileId, networkId) {
	const oldKey = "nulo:ui:balanceDisplayOption"
	const newKey = `nulo:ui:balanceDisplayOption@${profileId}`
	let option
	let optionsMap

	const oldResult = await chrome.storage.local.get(oldKey)
	if (oldKey in oldResult) {
		option = oldResult[oldKey]
		await chrome.storage.local.remove(oldKey)
		if (option) {
			await saveBalanceDisplayOption(profileId, networkId, option)
		}
	} else {
		const result = await chrome.storage.local.get(newKey)
		optionsMap = result[newKey] || {}

		option = optionsMap[networkId]
	}

	if (!option) {
		option = "total_account_value"
		optionsMap[networkId] = option
		await chrome.storage.local.set({ [newKey]: optionsMap })
	}

	appStore.displayOption = option
}
async function loadBalanceDisplayOption(profileId, networkId) {
	const key = `nulo:ui:balanceDisplayOption@${profileId}`

	const result = await chrome.storage.local.get(key)
	const optionsMap = result[key] || {}

	let option = optionsMap[networkId]

	if (!option) {
		option = "total_account_value"
		optionsMap[networkId] = option
		await chrome.storage.local.set({ [key]: optionsMap })
	}

	appStore.displayOption = option
}
async function saveBalanceDisplayOption(profileId, networkId, option) {
	const key = `nulo:ui:balanceDisplayOption@${profileId}`

	const result = await chrome.storage.local.get(key)
	const optionsMap = result[key] || {}

	if (optionsMap[networkId] !== option) {
		optionsMap[networkId] = option
		await chrome.storage.local.set({ [key]: optionsMap })
	}
}

watch(
	() => appStore.network,
	async () => {
		await loadBalanceDisplayOption(appStore.profile.id, appStore.network.id)
	},
)
watch(
	() => appStore.account,
	async () => {
		await fetchTokenBalances()
		if (!tokenToDisplay.value) {
			appStore.displayOption = "total_account_value"
		}
	},
)
watch(
	() => appStore.displayOption,
	async () => {
		await saveBalanceDisplayOption(appStore.profile.id, appStore.network.id, appStore.displayOption)
	},
)
watch(
	() => totalTokenBalance.value.value,
	async () => {
		if (showFullBalance.value) return

		dynamicFontSize.value = 2
		await nextTick()
		calcDynamicFontSize()
	},
)

onMounted(async () => {
	await fetchTokenBalances()

	await loadBalanceDisplayOptionMigration(appStore.profile.id, appStore.network.id) // Replace me with "loadBalanceDisplayOption" at some point

	if (!totalTokenBalance.value) return

	calcDynamicFontSize()
})
onBeforeUnmount(() => {
	taskService.disconnect()
	tokenBalanceService.disconnect()
	tokenService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<!-- Token detail header (back button + token name + actions) -->
		<Flex v-if="tokenBalance" align="center" justify="between" wide :class="$style.token_header">
			<Button @click="router.go(-1)" type="secondary" size="micro">
				<Icon name="arrow-right" size="12" color="secondary" style="transform: rotate(180deg)" />
			</Button>

			<Text size="12" weight="600" color="secondary" :class="$style.middle">{{ tokenToDisplay?.name }}</Text>

			<Flex align="center" gap="4">
				<Tooltip position="end" :disabled="isRefreshingBalance || !tokenBalance?.updatedAt">
					<Button @click="handleRefreshBalance" type="secondary" size="micro" :disabled="isRefreshingBalance">
						<Icon name="refresh" size="12" color="secondary" />
					</Button>

					<template #content>
						<Text color="secondary">Latest balance refresh - </Text>
						<Text>{{ DateTime.fromSeconds(tokenBalance?.updatedAt / 1_000).toRelative({ locale: "en" }) }}</Text>
					</template>
				</Tooltip>

				<Dropdown>
					<Button type="secondary" size="micro">
						<Icon name="dots" size="12" color="primary" />
					</Button>

					<template #popup>
						<DropdownItem @click="handleCopy(tokenToDisplay?.contract, 'Token address')">
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
			</Flex>
		</Flex>

		<!-- Balance section -->
		<section :class="$style.balance_section">
			<div
				@click="handleTokenBalanceClick"
				data-testid="balance-amount"
				:class="[$style.balance_amount, isRefreshingBalance && $style.refreshing]"
			>
				<template v-if="tokenToDisplay">
					{{ totalTokenBalance.value }}
					<span :class="$style.balance_symbol">{{ tokenToDisplay?.symbol }}</span>
				</template>
				<template v-else>$0.00</template>
			</div>

			<Flex v-if="tokenToDisplay" align="center" justify="center" gap="12" :class="$style.breakdown">
				<span :class="$style.breakdown_item">
					<span :class="$style.breakdown_dot" /> PRIVATE: {{ privateBalanceFormatted }}
				</span>
				<span :class="$style.breakdown_divider">|</span>
				<span :class="$style.breakdown_item">
					<span :class="[$style.breakdown_dot, $style.public_dot]" /> PUBLIC: {{ publicBalanceFormatted }}
				</span>
			</Flex>
		</section>

		<!-- Gas juice (home page only, not token detail) -->
		<GasBalanceCard v-if="!tokenBalance" />

		<!-- Action buttons -->
		<Flex :class="$style.actions">
			<ActionButtonsView :token="tokenBalance?.token" />
		</Flex>

		<!-- Split balances (token detail view only) -->
		<SplittedBalancesView v-if="tokenBalance" :tokenBalance="tokenBalanceToDisplay" />
	</Flex>
</template>

<style module>
.wrapper {
	padding: 0 24px 24px 24px;
}

.token_header {
	position: relative;
	min-height: 20px;
	margin-bottom: 16px;
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

.balance_section {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;

	margin-top: 32px;
	margin-bottom: 16px;
}

.balance_amount {
	font-family: var(--font-headline);
	font-size: 48px;
	font-weight: 700;
	letter-spacing: -0.04em;
	color: var(--txt-primary);
	cursor: pointer;

	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 100%;
}

.balance_symbol {
	font-size: 24px;
	color: var(--txt-tertiary);
}

@keyframes blink {
	0% { opacity: 1; }
	50% { opacity: 0.3; }
	100% { opacity: 1; }
}

.refreshing {
	animation: blink 2s linear infinite;
}

.breakdown {
	margin-top: 8px;
}

.breakdown_item {
	display: flex;
	align-items: center;
	gap: 6px;

	font-family: var(--font-mono);
	font-size: 11px;
	letter-spacing: 0.02em;
	color: var(--nulo-secondary);
}

.breakdown_dot {
	width: 6px;
	height: 6px;
	background: var(--nulo-accent);
}

.public_dot {
	background: var(--nulo-outline);
}

.breakdown_divider {
	color: var(--nulo-outline);
}

.actions {
	width: 100%;
	margin-top: 16px;
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
