<script setup>
/** Vendor */
import BigNumber from "bignumber.js"

/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"

/** Utils */
import { trimAddress } from "@/utils/string"
import { getRandomHex } from "@/wallet/utils"
import { getErrorData, getErrorMessage } from "@/wallet/utils/errors"
import { feeJuiceAddress, feeJuiceSymbol } from "@/wallet/utils/fee-juice"
import { getPrivateFpcAddress } from "@/wallet/utils/private-fpc"

/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Stores */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

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
	disabled: {
		type: Boolean,
		default: false,
	}
})

const FEE_METHOD_LS_KEY = "azguard:ui:feePaymentMethods"

const settings = defineModel()

const methodId = getRandomHex(6)
const methods = ref([
	{
		type: "fj",
		title: "Fee Juice",
	},
	{
		type: "fjwc",
		title: "Fee Juice with claim",
	},
	{
		type: "fpc",
		title: "FPC",
	},
])
const isCustomMethod = computed(() => settings.value?.paymentMethod.kind === "embedded")
const selectedMethod = ref()
const isMethodsDropdownOpen = ref(false)

const balances = ref([])
const privateFpc = ref(null)
// Synthetic balance that exposes Fee Juice (public) and Private Fee Juice
// (private) under the same shape as a regular TokenBalanceInfo, so the
// Visibility/Available snippet can be reused 1-to-1 with the FPC branch.
const fjWrappedBalance = computed(() => {
	const fjBal = balances.value?.find(b => b.token.contract === feeJuiceAddress)
	const pfjAddr = privateFpc.value?.address
	const pfjBal = pfjAddr ? balances.value?.find(b => b.token.contract === pfjAddr) : undefined
	return {
		publicBalance: fjBal?.publicBalance ?? "0",
		privateBalance: pfjBal?.privateBalance ?? "0",
		token: {
			symbol: feeJuiceSymbol,
			decimals: fjBal?.token?.decimals ?? 18,
		},
	}
})
const isLoading = ref(false)
const error = ref("")

const cacheEntry = computed(() => cacheStore.feePaymentMethods.find(m => m.id === methodId))
const selectedFpc = computed(() => cacheEntry.value?.fpc)
const fpcBalance = computed(() => balances.value?.find(b => b.token.contract === selectedFpc.value?.asset))
const claimParameters = computed(() => cacheEntry.value?.claimParameters)
const isClaimParametersFilled = computed(() => !!(selectedMethod.value?.claimAmount && selectedMethod.value?.claimSecret && selectedMethod.value?.messageLeafIndex))

const handleFillClaimParameters = () => {
	popupStore.open("edit_claim_parameters", { id: methodId })
}
const handleSelectFPC = () => {
	popupStore.open("select_fpc", { id: methodId })
}

const inferPublicMode = (balance) => balance?.privateBalance === "0" && balance?.publicBalance !== "0"
const upsertFpcInCache = (fpc) => {
	const ix = cacheStore.feePaymentMethods.findIndex(m => m.id === methodId)
	if (ix === -1) cacheStore.feePaymentMethods.push({ id: methodId, fpc })
	else cacheStore.feePaymentMethods[ix].fpc = fpc
}

const defaultFjInPublic = () => {
	if (!privateFpc.value) return true
	const wb = fjWrappedBalance.value
	const fjZero = (wb.publicBalance ?? "0") === "0"
	const pfjNonZero = (wb.privateBalance ?? "0") !== "0"
	return !(fjZero && pfjNonZero)
}

const showVisibility = (m) => {
	if (!m) return false
	if (m.type === "fj") return !!privateFpc.value
	if (m.type === "fpc") return m.fpc?.type === FpcType.DefaultFpc
	return false
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

	const idx = balances.value?.findIndex(b => b.id === balance.id)
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

	const idx = balances.value?.findIndex(b => b.id === balance.id)
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

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
tokenBalanceService.onTokenBalanceDeleted.add(onBalanceDeleted)
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)

const saveSelectedMethod = async (method) => {
	const fpms = (await chrome.storage.local.get(FEE_METHOD_LS_KEY))[FEE_METHOD_LS_KEY] || {}
	fpms[props.account.address] = method
	chrome.storage.local.set({ [FEE_METHOD_LS_KEY]: fpms })

	if (method.type === "fpc") {
		upsertFpcInCache(method.fpc)
	}
}

const init = async () => {
	try {
		isLoading.value = true

		if (props.network && props.account && !isCustomMethod.value) {
			const [allBalances, privateFpcAddr, allFpcs, savedStore] = await Promise.all([
				tokenBalanceService.getTokenBalances(undefined, props.account.address),
				getPrivateFpcAddress(),
				fpcService.getFpcs(props.network.chainId),
				chrome.storage.local.get(FEE_METHOD_LS_KEY),
			])
			balances.value = allBalances
			privateFpc.value = allFpcs.find(
				f => f.type === FpcType.PrivateFpc && f.address === privateFpcAddr
			) ?? null

			const restored = (savedStore[FEE_METHOD_LS_KEY] || {})[props.account.address]
			if (restored?.type === "fj") {
				const inPublic = privateFpc.value && typeof restored.inPublic === "boolean"
					? restored.inPublic
					: true
				selectedMethod.value = { ...methods.value[0], inPublic }
			} else if (restored?.type === "fjwc") {
				selectedMethod.value = { ...methods.value[1] }
			} else if (restored?.type === "fpc" && restored.fpc) {
				upsertFpcInCache(restored.fpc)
				const balance = fpcBalance.value
				selectedMethod.value = {
					...methods.value[2],
					fpc: restored.fpc,
					balance,
					inPublic: typeof restored.inPublic === "boolean"
						? restored.inPublic
						: inferPublicMode(balance),
				}
			} else {
				selectedMethod.value = { ...methods.value[0], inPublic: defaultFjInPublic() }
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
			case "fj":
				if (selectedMethod.value.inPublic === undefined) {
					selectedMethod.value = {
						...selectedMethod.value,
						inPublic: defaultFjInPublic(),
					}
					break
				}
				if (!showVisibility(selectedMethod.value) && selectedMethod.value.inPublic === false) {
					selectedMethod.value = { ...selectedMethod.value, inPublic: true }
					break
				}
				if (isZeroBalance({ balance: fjWrappedBalance.value, inPublic: selectedMethod.value.inPublic })) {
					settings.value = undefined
					break
				}
				if (selectedMethod.value.inPublic) {
					settings.value = { paymentMethod: { kind: "fj" } }
				} else {
					settings.value = {
						paymentMethod: {
							kind: "fpc",
							fpcId: privateFpc.value.id,
						},
					}
				}
				saveSelectedMethod({ type: "fj", inPublic: selectedMethod.value.inPublic })
				break
			case "fjwc":
				if (!selectedMethod.value.claimAmount && claimParameters.value) {
					selectedMethod.value = {
						...selectedMethod.value,
						claimAmount: claimParameters.value.claimAmount,
						claimSecret: claimParameters.value.claimSecret,
						messageLeafIndex: claimParameters.value.messageLeafIndex,
					}
					break
				}
				if (!selectedMethod.value.claimAmount || !selectedMethod.value.claimSecret || !selectedMethod.value.messageLeafIndex) {
					settings.value = undefined
					break
				}
				settings.value = {
					paymentMethod: {
						kind: "fjwc",
						claimAmount: selectedMethod.value.claimAmount,
						claimSecret: selectedMethod.value.claimSecret,
						messageLeafIndex: selectedMethod.value.messageLeafIndex,
					},
				}
				saveSelectedMethod({ type: "fjwc" })
				break
			case "fpc":
				if (!selectedMethod.value.fpc && selectedFpc.value) {
					selectedMethod.value = {
						...selectedMethod.value,
						fpc: selectedFpc.value,
						balance: fpcBalance.value,
						inPublic: inferPublicMode(fpcBalance.value),
					}
					break
				}
				if (!selectedMethod.value.fpc) {
					settings.value = undefined
					break
				}
				switch (selectedMethod.value.fpc.type) {
					case FpcType.DefaultSponsoredFpc:
						settings.value = {
							paymentMethod: {
								kind: "fpc",
								fpcId: selectedMethod.value.fpc.id,
							},
						}
						saveSelectedMethod({ type: "fpc", fpc: selectedMethod.value.fpc })
						break
					case FpcType.PrivateFpc:
					case FpcType.DefaultFpc:
						if (isZeroBalance(selectedMethod.value)) {
							settings.value = undefined
							break
						}
						settings.value = {
							paymentMethod: {
								kind: "fpc",
								fpcId: selectedMethod.value.fpc.id,
								inPublic: selectedMethod.value.inPublic,
							},
						}
						saveSelectedMethod({
							type: "fpc",
							fpc: selectedMethod.value.fpc,
							inPublic: selectedMethod.value.inPublic,
						})
						break
					default:
						break
				}
				break
			default:
				break
		}
	},
	{ deep: true },
)
watch(
	() => selectedFpc.value,
	() => {
		if (selectedMethod.value?.type === "fpc") {
			selectedMethod.value = {
				...selectedMethod.value,
				fpc: selectedFpc.value,
				balance: fpcBalance.value,
				inPublic: inferPublicMode(fpcBalance.value),
			}
		}
	}
)
watch(
	() => claimParameters.value,
	() => {
		if (selectedMethod.value?.type === "fjwc") {
			selectedMethod.value = {
				...selectedMethod.value,
				claimAmount: claimParameters.value.claimAmount,
				claimSecret: claimParameters.value.claimSecret,
				messageLeafIndex: claimParameters.value.messageLeafIndex,
			}
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
	tokenBalanceService.disconnect()
	cacheStore.feePaymentMethods = cacheStore.feePaymentMethods.filter(m => m.id !== methodId)
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex align="center" justify="between" :class="$style.card">
			<Text size="13" weight="600" color="primary">Pay fee with</Text>

			<Text v-if="isCustomMethod" size="13" weight="600" color="primary"> Embedded payload </Text>
			<Dropdown v-else @onOpen="isMethodsDropdownOpen = true" @onClose="isMethodsDropdownOpen = false" :disabled="disabled" :class="disabled && $style.disabled">
				<template #trigger>
					<Spinner v-if="isLoading" color="--txt-primary" />
					<Flex v-else align="center" gap="8" class="clickable">
						<template v-if="selectedMethod">
							<Icon name="discount" size="16" color="purple" />
							<Text size="13" weight="600" color="primary">
								{{ selectedMethod.title }}
							</Text>
						</template>
						<Text v-else size="13" weight="600" color="red" style="padding: 2px 0"> Select method </Text>
						<Icon
							name="chevron"
							size="12"
							color="secondary"
							:style="{
								transform: `rotate(${isMethodsDropdownOpen ? '180' : '0'}deg)`,
								transition: 'all 0.2s ease'
							}"
						/>
					</Flex>
				</template>

				<template #popup>
					<DropdownItem
						v-for="method in methods"
						:key="method.type"
						@click="selectedMethod = { ...method }"
					>
						<Flex align="center" gap="8">
							<Text size="13" weight="600" color="primary">
								{{ method.title }}
							</Text>
						</Flex>
					</DropdownItem>
				</template>
			</Dropdown>
		</Flex>

		<template v-if="error">
			<Flex align="start" gap="6" wide :class="$style.card">
				<Icon
					name="info"
					size="14"
					color="red"
				/>

				<Text size="12" weight="600" color="secondary" :style="{ paddingTop: '1px' }">
					{{ error }}
				</Text>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type === 'fj'">
			<Flex
				v-if="showVisibility(selectedMethod)"
				align="center" justify="between"
				:class="$style.fjc_price"
				:style="{padding: '6px 12px'}"
			>
				<Text size="12" weight="600" color="secondary"> Visibility </Text>
				<Flex
					@click="selectedMethod.inPublic = !selectedMethod.inPublic"
					align="center" gap="6"
					:class="$style.type"
				>
					<Icon
						:name="selectedMethod.inPublic ? 'face' : 'key-square'"
						size="16"
						:color="selectedMethod.inPublic ? 'orange' : 'green'"
					/>
					<Text size="13" weight="600" color="primary" class="capitalize">
						{{ selectedMethod.inPublic ? 'Public' : 'Private' }}
					</Text>
				</Flex>
			</Flex>
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> Available </Text>
				<Text
					size="12" weight="600"
					:color="isZeroBalance({ balance: fjWrappedBalance, inPublic: selectedMethod.inPublic }) ? 'red' : 'primary'"
				>
					{{ formatBalance(fjWrappedBalance, selectedMethod.inPublic) }} {{ fjWrappedBalance.token.symbol }}
				</Text>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type === 'fjwc'">
			<Flex v-if="isClaimParametersFilled" direction="column" gap="12" :class="$style.fjc_price">
				<Flex align="center" justify="between" wide>
					<Text size="12" weight="600" color="secondary"> Claim amount </Text>
					<Text size="12" weight="600" color="primary"> {{ selectedMethod.claimAmount }} </Text>
				</Flex>
				<Flex align="center" justify="between" wide>
					<Text size="12" weight="600" color="secondary"> Claim secret </Text>
					<Text size="12" weight="600" color="primary"> {{ trimAddress(selectedMethod.claimSecret) }} </Text>
				</Flex>
				<Flex align="center" justify="between" wide>
					<Text size="12" weight="600" color="secondary"> Message leaf index </Text>
					<Text size="12" weight="600" color="primary"> {{ trimAddress(selectedMethod.messageLeafIndex) }} </Text>
				</Flex>
			</Flex>
			<Flex align="center" justify="end" :class="$style.fjc_price" :style="{paddingTop: `${isClaimParametersFilled ? '0px' : '12px'}` }">
				<Flex @click="handleFillClaimParameters" :style="{ cursor: 'pointer'}" :class="disabled && $style.disabled">
					<Flex align="center" gap="6">
						<Text
							size="12"
							weight="600"
							:color="isClaimParametersFilled ? 'green' : 'red'"
						>
							Edit parameters
						</Text>
						<Icon
							name="edit"
							size="12"
							:color="isClaimParametersFilled ? 'green' : 'red'"
						/>
					</Flex>
				</Flex>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type ==='fpc'">
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> FPC </Text>

				<Flex @click="handleSelectFPC" :style="{ cursor: 'pointer'}" :class="disabled && $style.disabled">
					<Text v-if="!selectedMethod.fpc" size="13" weight="600" color="red" :style="{paddingRight: '8px'}"> Select FPC </Text>
					<Text v-else size="12" weight="600" color="primary"> {{ selectedMethod.fpc.name || trimAddress(selectedMethod.fpc.address) }} </Text>
				</Flex>
			</Flex>
			<template v-if="selectedMethod.fpc && selectedMethod.balance && (selectedMethod.fpc.type === FpcType.DefaultFpc || selectedMethod.fpc.type === FpcType.PrivateFpc)">
				<Flex
					v-if="showVisibility(selectedMethod)"
					align="center" justify="between"
					:class="$style.fjc_price"
					:style="{padding: '6px 12px'}"
				>
					<Text size="12" weight="600" color="secondary"> Visibility </Text>
					<Flex
						@click="selectedMethod.inPublic = !selectedMethod.inPublic"
						align="center" gap="6"
						:class="$style.type"
					>
						<Icon
							:name="selectedMethod.inPublic ? 'face' : 'key-square'"
							size="16"
							:color="selectedMethod.inPublic ? 'orange' : 'green'"
						/>
						<Text size="13" weight="600" color="primary" class="capitalize">
							{{ selectedMethod.inPublic ? 'Public' : 'Private' }}
						</Text>
					</Flex>
				</Flex>
				<Flex align="center" justify="between" :class="$style.fjc_price">
					<Text size="12" weight="600" color="secondary"> Available </Text>
					<Text size="12" weight="600" :color="isZeroBalance(selectedMethod) ? 'red' : 'primary'">
						{{ formatBalance(selectedMethod.balance, selectedMethod.fpc.type === FpcType.DefaultFpc ? selectedMethod.inPublic : false) }}
						{{ selectedMethod.balance.token.symbol }}
					</Text>
				</Flex>
			</template>
		</template>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 1px 2px var(--shadow-5), inset 0 0 0 1px var(--border);

	opacity: 0.65;
}

.card {
	border-radius: 12px 12px 0 0;

	padding: 12px;
}

.fjc_price {
	background: var(--gray-5);
	overflow: hidden;

	padding: 12px;
}

.type {
	cursor: pointer;
	background: var(--gray-5);
	box-shadow: inset 0 0 0 1px var(--border);

	border-radius: 6px;

	padding: 4px;
}

.disabled {
	cursor: default;
	pointer-events: none;

	opacity: 0.5;
}
</style>
