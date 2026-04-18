<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"

/** Vendor */
import BigNumber from "bignumber.js"

import { getRandomHex } from "@/wallet/utils"
import { getErrorData, getErrorMessage } from "@/wallet/utils/errors"
import { UI_STORAGE_KEYS } from "@/popup/constants/storage-keys"
/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Stores */
import { useCacheStore } from "@/stores/cache.store"
const cacheStore = useCacheStore()

const props = defineProps({
	profile: {
		type: Object,
	},
	network: {
		type: Object,
	},
	account: {
		type: Object,
	},
	feeEstimate: {
		type: Object,
		default: null,
	},
	isEstimating: {
		type: Boolean,
		default: false,
	},
	/** When mounted inside another bordered container (e.g. execute window's
	 *  operation card), the outer wrapper's own border + overflow:hidden
	 *  clash with the parent's border. Passing embedded=true strips the root
	 *  border so the parent can own the single border. */
	embedded: {
		type: Boolean,
		default: false,
	},
})

const FEE_METHOD_LS_KEY = UI_STORAGE_KEYS.FEE_PAYMENT_METHODS

const settings = defineModel()

const methodId = getRandomHex(6)
const registeredFpcs = ref([])

const privateFpc = computed(() => registeredFpcs.value.find((f) => f.type === FpcType.PrivateFpc))

const methods = computed(() => {
	const base = [
		{
			type: "fj",
			title: "Fee Juice",
			subtitle: "public",
			inPublic: true,
		},
		{
			type: "private_fpc",
			title: privateFpc.value?.name || "Private Fee Juice",
			subtitle: "private",
			fpc: privateFpc.value,
		},
	]

	for (const fpc of registeredFpcs.value) {
		if (fpc.type === FpcType.PrivateFpc) {
		} else if (fpc.type === FpcType.DefaultSponsoredFpc) {
			base.push({
				type: "fpc",
				title: fpc.name || "Sponsored FPC",
				subtitle: "sponsored",
				fpc,
			})
		} else if (fpc.type === FpcType.DefaultFpc) {
			base.push({
				type: "fpc",
				title: fpc.name || "FPC",
				subtitle: fpc.asset ? "token" : "fpc",
				fpc,
			})
		}
	}

	base.push({
		type: "token_fpc",
		title: "Token FPC",
		subtitle: "coming soon",
		disabled: true,
	})

	return base
})

const priorityLevels = [
	{ value: "normal", label: "Normal", multiplier: 2 },
	{ value: "fast", label: "Fast", multiplier: 3 },
	{ value: "urgent", label: "Urgent", multiplier: 5 },
]

const isCustomMethod = computed(() => settings.value?.paymentMethod.kind === "embedded")
const useOwnMethod = ref(false)
const selectedMethod = ref()
const selectedPriority = ref("normal")
const isMethodsDropdownOpen = ref(false)

const gasBalances = ref({ publicFeeJuice: "0", privateFeeJuice: null })
const balances = ref([])
const isLoading = ref(false)
const error = ref("")

const selectedFpc = computed(() => cacheStore.feePaymentMethods.find((m) => m.id === methodId)?.fpc)
const fpcBalance = computed(() => balances.value?.find((b) => b.token.contract === selectedFpc.value?.asset))

const FEE_JUICE_DECIMALS = 18

const estimatedFeeDisplay = computed(() => {
	if (!props.feeEstimate) return null
	return {
		amount: props.feeEstimate.maxFeeFormatted,
		usd: props.feeEstimate.maxFeeUsd,
	}
})

const formatGasBalance = (raw) => {
	const amount = new BigNumber(raw)
	if (amount.isZero()) return "0"
	return amount.div(new BigNumber(`1${"0".repeat(FEE_JUICE_DECIMALS)}`)).toFormat()
}

const feeJuiceBalanceFormatted = computed(() => formatGasBalance(gasBalances.value.publicFeeJuice))
const privateFeeJuiceFormatted = computed(() =>
	gasBalances.value.privateFeeJuice !== null ? formatGasBalance(gasBalances.value.privateFeeJuice) : null,
)

const showMethodSelector = computed(() => {
	if (!isCustomMethod.value) return true
	return useOwnMethod.value
})

const handleUseOwnMethod = () => {
	useOwnMethod.value = true
}
const handleUseEmbedded = () => {
	useOwnMethod.value = false
	selectedMethod.value = undefined
	settings.value = { paymentMethod: { kind: "embedded" } }
}

const isZeroBalance = (method) => {
	return ((method.inPublic ? method.balance?.publicBalance : method.balance?.privateBalance) ?? "0") === "0"
}

const formatBalance = (tb, inPublic) => {
	let amount = new BigNumber((inPublic ? tb.publicBalance : tb.privateBalance) ?? "0")
	amount = amount.div(new BigNumber(`1${"0".repeat(tb.token.decimals)}`))
	return amount.toFormat()
}

const onBalanceAdded = async (balance) => {
	if (balance.account !== props.account?.address) {
		return
	}

	balances.value.push(balance)
	if (selectedMethod.value?.balance?.id === balance.id) {
		selectedMethod.value.balance = balance
	}
}
const onBalanceUpdated = (balance) => {
	if (balance.account !== props.account?.address) {
		return
	}

	const idx = balances.value?.findIndex((b) => b.id === balance.id)
	if (idx !== -1) {
		balances.value[idx] = balance
	}
	if (selectedMethod.value?.balance?.id === balance.id) {
		selectedMethod.value.balance = balance
	}
}
const onBalanceDeleted = (balance) => {
	if (balance.account !== props.account?.address) {
		return
	}

	const idx = balances.value?.findIndex((b) => b.id === balance.id)
	if (idx !== -1) {
		balances.value?.splice(idx, 1)
	}
	if (selectedMethod.value?.balance?.id === balance.id) {
		selectedMethod.value = undefined
		openToast({ label: "Balance updated, reselect payment method" })
	}
}
const onFpcUpdated = (fpc) => {
	if (selectedMethod.value?.fpc?.id === fpc.id) {
		selectedMethod.value.fpc.name = fpc.name
	}
}
const onFpcDeleted = (fpc) => {
	if (selectedMethod.value?.fpc?.id === fpc.id) {
		selectedMethod.value = undefined
		openToast({ label: "Selected FPC was deleted" })
	}
}

const fpcService = new FpcServiceClient()
fpcService.onFpcDeleted.add(onFpcDeleted)
fpcService.onFpcUpdated.add(onFpcUpdated)

const executionService = new ExecutionServiceClient()

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
tokenBalanceService.onTokenBalanceDeleted.add(onBalanceDeleted)
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)

const buildSettings = (paymentMethod, priority) => {
	if (!paymentMethod) return undefined
	const result = { paymentMethod }
	if (priority && priority !== "normal") {
		result.priorityLevel = priority
	}
	return result
}

const saveSelectedMethod = async (method) => {
	const fpms = (await chrome.storage.local.get(FEE_METHOD_LS_KEY))[FEE_METHOD_LS_KEY] || {}
	fpms[props.account.address] = method
	chrome.storage.local.set({ [FEE_METHOD_LS_KEY]: fpms })

	if (method.type === "fpc" || method.type === "private_fpc") {
		cacheStore.feePaymentMethods.push({
			id: methodId,
			fpc: method.fpc,
		})
	}
}

const init = async () => {
	try {
		isLoading.value = true

		if (props.network && props.account && (!isCustomMethod.value || useOwnMethod.value)) {
			const [gasResult, tokenBalances, fpcs] = await Promise.all([
				executionService.getGasBalances(props.network.id, props.account.address),
				tokenBalanceService.getTokenBalances(undefined, props.account.address),
				fpcService.getFpcs(props.network.chainId),
			])
			gasBalances.value = gasResult
			balances.value = tokenBalances
			registeredFpcs.value = fpcs ?? []

			const saved = (await chrome.storage.local.get(FEE_METHOD_LS_KEY))[FEE_METHOD_LS_KEY] || {}
			if (saved[props.account.address]) {
				selectedMethod.value = saved[props.account.address]
				if (fpcBalance.value) {
					selectedMethod.value.balance = fpcBalance.value
				}
			} else {
				// Auto-select the first sponsored FPC if available
				const sponsoredMethod = methods.value.find((m) => m.fpc?.type === FpcType.DefaultSponsoredFpc)
				if (sponsoredMethod) {
					selectedMethod.value = {
						...sponsoredMethod,
						balance: undefined,
						inPublic: undefined,
					}
				}
			}
		}
	} catch (e) {
		console.error("Failed to init", getErrorData(e))
		error.value = getErrorMessage(e)
	} finally {
		isLoading.value = false
	}
}

watch(
	() => selectedMethod.value,
	() => {
		switch (selectedMethod.value?.type) {
			case "fj": {
				if (gasBalances.value.publicFeeJuice === "0") {
					settings.value = undefined
					break
				}
				settings.value = buildSettings({ kind: "fj" }, selectedPriority.value)
				saveSelectedMethod(selectedMethod.value)
				break
			}
			case "private_fpc": {
				if (!selectedMethod.value.fpc) {
					// No PrivateFPC registered yet
					settings.value = undefined
					break
				}
				settings.value = buildSettings(
					{
						kind: "fpc",
						fpcId: selectedMethod.value.fpc.id,
					},
					selectedPriority.value,
				)
				saveSelectedMethod(selectedMethod.value)
				break
			}
			case "fpc": {
				if (!selectedMethod.value.fpc) {
					settings.value = undefined
					break
				}
				const fpcType = selectedMethod.value.fpc.type
				if (fpcType === FpcType.DefaultFpc) {
					if (isZeroBalance(selectedMethod.value)) {
						settings.value = undefined
						break
					}
					settings.value = buildSettings(
						{
							kind: "fpc",
							fpcId: selectedMethod.value.fpc.id,
							inPublic: selectedMethod.value.inPublic,
						},
						selectedPriority.value,
					)
				} else {
					// DefaultSponsoredFpc, PrivateFpc
					settings.value = buildSettings(
						{
							kind: "fpc",
							fpcId: selectedMethod.value.fpc.id,
						},
						selectedPriority.value,
					)
				}
				saveSelectedMethod(selectedMethod.value)
				break
			}
			default:
				break
		}
	},
	{ deep: true },
)
watch(
	() => selectedPriority.value,
	() => {
		if (settings.value?.paymentMethod) {
			settings.value = buildSettings(settings.value.paymentMethod, selectedPriority.value)
		}
	},
)
watch(
	() => [props.profile, props.network, props.account],
	async () => {
		await init()
	},
)

onBeforeMount(async () => {
	fpcService.connect()
	tokenBalanceService.connect()
	await init()
})
onBeforeUnmount(() => {
	fpcService.disconnect()
	executionService.disconnect()
	tokenBalanceService.disconnect()
	cacheStore.feePaymentMethods = cacheStore.feePaymentMethods.filter((m) => m.id !== methodId)
})
</script>

<template>
	<Flex direction="column" :class="[$style.wrapper, embedded && $style.embedded]">
		<!-- Embedded fee override banner -->
		<template v-if="isCustomMethod && !useOwnMethod">
			<Flex align="center" justify="between" :class="$style.card">
				<Text size="13" weight="600" color="primary">Pay fee with</Text>
				<Text size="13" weight="600" color="primary">Embedded payload</Text>
			</Flex>
			<Flex direction="column" gap="8" :class="$style.detail_row">
				<Text size="12" weight="600" color="secondary">
					The app includes fee payment in the transaction.
				</Text>
				<Flex @click="handleUseOwnMethod" align="center" gap="4" :class="$style.link" data-testid="send-fee-override">
					<Text size="12" weight="600" color="blue">Override with my method</Text>
					<Icon name="arrow-right" size="10" color="blue" />
				</Flex>
			</Flex>
		</template>

		<!-- Method selector -->
		<template v-if="showMethodSelector">
			<Flex direction="column" gap="4" :class="$style.card">
				<span :class="$style.fee_label">Fee Source</span>
				<Dropdown @onOpen="isMethodsDropdownOpen = true" @onClose="isMethodsDropdownOpen = false">
					<template #trigger>
						<Spinner v-if="isLoading" color="--txt-primary" />
						<Flex
							v-else
							align="center"
							justify="between"
							class="clickable"
							data-testid="send-fee-method-trigger"
							:data-fee-method="selectedMethod?.subtitle"
						>
							<span v-if="selectedMethod" :class="$style.fee_value">{{ selectedMethod.title }}</span>
							<span v-else :class="[$style.fee_value, $style.fee_error]">Select method</span>
							<MaterialIcon name="expand_more" :size="16" color="secondary" />
						</Flex>
					</template>

					<template #popup>
						<DropdownItem
							v-for="method in methods"
							:key="method.fpc?.id ?? method.type"
							:disabled="method.disabled"
							:data-testid="`send-fee-method-${method.subtitle}`"
							@click="!method.disabled && (selectedMethod = method)"
						>
							<Flex align="center" justify="between" gap="8" wide>
								<Text size="13" weight="600" :color="method.disabled ? 'tertiary' : 'primary'">
									{{ method.title }}
								</Text>
								<Text size="11" color="tertiary">
									{{ method.subtitle }}
								</Text>
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<!-- Back to embedded link -->
			<Flex v-if="isCustomMethod && useOwnMethod" align="center" justify="end" :class="$style.detail_row" :style="{ padding: '6px 12px' }">
				<Flex @click="handleUseEmbedded" align="center" gap="4" :class="$style.link" data-testid="send-fee-back-embedded">
					<Icon name="arrow-right" size="10" color="blue" style="transform: rotate(180deg)" />
					<Text size="12" weight="600" color="blue">Use app's payment</Text>
				</Flex>
			</Flex>

			<!-- Error -->
			<template v-if="error">
				<Flex align="start" gap="6" wide :class="$style.detail_row">
					<Icon name="info" size="14" color="red" />
					<Text size="12" weight="600" color="secondary" :style="{ paddingTop: '1px' }">
						{{ error }}
					</Text>
				</Flex>
			</template>

			<!-- Fee Juice details -->
			<template v-else-if="selectedMethod?.type === 'fj'">
				<Flex align="center" justify="between" :class="$style.detail_row">
					<Text size="12" weight="600" color="secondary"> Available </Text>
					<Text size="12" weight="600" :color="feeJuiceBalanceFormatted === '0' ? 'red' : 'primary'">
						{{ feeJuiceBalanceFormatted }} Fee Juice
					</Text>
				</Flex>
			</template>

			<!-- Private Fee Juice (PrivateFPC) details -->
			<template v-else-if="selectedMethod?.type === 'private_fpc'">
				<template v-if="selectedMethod.fpc">
					<Flex align="center" justify="between" :class="$style.detail_row">
						<Flex align="center" gap="4">
							<Icon name="key-square" size="12" color="green" />
							<Text size="12" weight="600" color="secondary"> Available </Text>
						</Flex>
						<Text size="12" weight="600" :color="privateFeeJuiceFormatted === '0' ? 'red' : 'primary'">
							{{ privateFeeJuiceFormatted ?? '—' }} FJ
						</Text>
					</Flex>
				</template>
				<template v-else>
					<Flex align="start" gap="6" :class="$style.detail_row">
						<Icon name="info" size="14" color="orange" />
						<Text size="12" weight="600" color="secondary" :style="{ paddingTop: '1px' }">
							Private Fee Juice not available on this network.
						</Text>
					</Flex>
				</template>
			</template>

			<!-- FPC details (DefaultFpc / DefaultSponsoredFpc) -->
			<template v-else-if="selectedMethod?.type === 'fpc' && selectedMethod.fpc">
				<template v-if="selectedMethod.fpc.type === FpcType.DefaultFpc">
					<Flex align="center" justify="between" :class="$style.detail_row" :style="{padding: '6px 12px'}">
						<Text size="12" weight="600" color="secondary"> Visibility </Text>

						<Flex
							@click="selectedMethod.inPublic ? selectedMethod.inPublic = false : selectedMethod.inPublic = true"
							align="center"
							gap="6"
							data-testid="send-fee-visibility-toggle"
							:class="$style.type"
						>
							<Icon
								:name="selectedMethod.inPublic  ? 'face' : 'key-square'"
								size="16"
								:color="selectedMethod.inPublic ? 'orange' : 'green'"
							/>
							<Text size="13" weight="600" color="primary" class="capitalize">
								{{ selectedMethod.inPublic ? 'Public' : 'Private' }}
							</Text>
						</Flex>
					</Flex>
					<Flex align="center" justify="between" :class="$style.detail_row">
						<Text size="12" weight="600" color="secondary"> Available </Text>
						<Text size="12" weight="600" :color="isZeroBalance(selectedMethod) ? 'red' : 'primary'">
							{{ formatBalance(selectedMethod.balance, selectedMethod.inPublic) }}
							{{ selectedMethod.balance.token.symbol }}
						</Text>
					</Flex>
				</template>
			</template>

			<!-- Fee Estimate -->
			<template v-if="selectedMethod && isEstimating && !estimatedFeeDisplay">
				<Flex align="center" justify="between" :class="$style.detail_row">
					<span :class="$style.fee_label">Estimated Network Fee</span>
					<span :class="$style.skeleton" />
				</Flex>
			</template>
			<template v-else-if="selectedMethod && estimatedFeeDisplay">
				<Flex align="center" justify="between" :class="$style.detail_row">
					<span :class="$style.fee_label">Estimated Network Fee</span>
					<span :class="$style.fee_value">~{{ estimatedFeeDisplay.amount }} FJ</span>
				</Flex>
			</template>
			<template v-else-if="selectedMethod">
				<Flex align="center" gap="4" :class="$style.detail_row">
					<Icon name="info" size="12" color="tertiary" />
					<Text size="11" weight="500" color="tertiary">Fee estimated after simulation</Text>
				</Flex>
			</template>

			<!-- Priority selector -->
			<template v-if="selectedMethod">
				<Flex direction="column" gap="8" :class="$style.detail_row">
					<span :class="$style.fee_label">Priority</span>
					<div :class="$style.priority_grid">
						<button
							v-for="level in priorityLevels"
							:key="level.value"
							@click="selectedPriority = level.value"
							:data-testid="`send-fee-priority-${level.value}`"
							:class="[$style.priority_btn, selectedPriority === level.value && $style.priority_active]"
						>
							{{ level.label }}
						</button>
					</div>
				</Flex>
			</template>
		</template>
	</Flex>
</template>

<style module>
.wrapper {
	border: 1px solid var(--nulo-outline);
	overflow: hidden;
}

.embedded {
	border: none;
}

.card {
	padding: 12px;
}

.detail_row {
	background: transparent;
	overflow: hidden;
	border-top: 1px solid rgba(74, 70, 63, 0.2);

	padding: 10px 12px;
}

.type {
	cursor: pointer;
	background: var(--nulo-surface-high);

	padding: 4px 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-highest);
	}
}

.link {
	cursor: pointer;

	& span,
	& svg {
		transition: all 0.2s var(--bezier);
	}

	&:hover {
		& span {
			color: var(--txt-primary);
		}

		& svg {
			fill: var(--txt-primary);
		}
	}
}

.fee_label {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--nulo-secondary);
}

.fee_value {
	font-family: var(--font-mono);
	font-size: 12px;
	color: var(--txt-primary);
}

.fee_error {
	color: var(--red);
}

.priority_grid {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 8px;
}

.priority_btn {
	padding: 6px 0;
	cursor: pointer;

	font-family: var(--font-mono);
	font-size: 9px;
	font-weight: 500;
	text-transform: uppercase;
	text-align: center;
	color: var(--nulo-secondary);

	background: transparent;
	border: 1px solid #231f1c;

	transition: all 0.15s ease;

	&:hover {
		border-color: var(--nulo-accent);
	}
}

.priority_active {
	border-color: var(--nulo-accent);
	color: var(--txt-primary);
}

.skeleton {
	display: inline-block;
	width: 60px;
	height: 12px;
	background: linear-gradient(90deg, var(--nulo-surface-high) 25%, var(--nulo-surface) 50%, var(--nulo-surface-high) 75%);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
	0% { background-position: 200% 0; }
	100% { background-position: -200% 0; }
}
</style>
