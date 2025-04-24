<script setup>
/** Vendor */
import BigNumber from "bignumber.js"

/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"

/** Utils */
import { trimAddress } from "@/utils/string"
import { getRandomHex } from "@/wallet/utils"

/** Services */
import {
	FeeJuicePaymentMethod,
	FeeJuiceWithClaimPaymentMethod,
	FeePaymentMethodType,
	FeeSettings,
	FpcPaymentMethod,
} from "@/wallet/services/execution/client"
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
})

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
const isCustomMethod = computed(() => settings.value?.paymentMethod.type === FeePaymentMethodType.Custom)
const selectedMethod = ref()
const isMethodsDropdownOpen = ref(false)

const balances = ref([])
const feeJuiceBalance = computed(() => balances.value?.find(isFeeJuice))
const loading = ref(false)
const error = ref("")

const selectedFpc = computed(() => cacheStore.feePaymentMethods.find(m => m.id === methodId)?.fpc)
const claimParameters = computed(() => cacheStore.feePaymentMethods.find(m => m.id === methodId)?.claimParameters)
const isClaimParametersFilled = computed(() => !!(selectedMethod.value?.claimAmount && selectedMethod.value?.claimSecret && selectedMethod.value?.messageLeafIndex))

const handleFillClaimParameters = () => {
	popupStore.open("edit_claim_parameters", { id: methodId })
}
const handleSelectFPC = () => {
	popupStore.open("select_fpc", { id: methodId })
}

const isFeeJuice = (tb) => {
	return tb.token.contract === "0x0000000000000000000000000000000000000000000000000000000000000005"
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
	if (selectedMethod.value.fpc?.type === FpcType.DefaultFpc) {
		if (selectedMethod.value.fpc?.balance.id === balance.id) {
			selectedMethod.value.balance = balance
		}
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
const fpcService = new FpcServiceClient(undefined, undefined, undefined, onFpcUpdated, onFpcDeleted)
const tokenBalanceService = new TokenBalanceServiceClient(
	undefined,
	undefined,
	onBalanceAdded,
	onBalanceUpdated,
	onBalanceDeleted,
)

const init = async () => {
	try {
		loading.value = true

		if (props.network && props.account) {
			balances.value = await tokenBalanceService.getTokenBalances(undefined, props.account.address)
			methods.value[0].balance = feeJuiceBalance.value
			methods.value[1].balance = feeJuiceBalance.value
		}
	} catch (e) {
		console.error("Failed to init", e)
		error.value = (e)?.message ?? e
	} finally {
		loading.value = false
	}
}

watch(
	() => selectedMethod.value,
	() => {
		switch (selectedMethod.value?.type) {
			case "fj":
				if (isZeroBalance(selectedMethod.value)) {
					settings.value = undefined
					break;
				}
				settings.value = new FeeSettings(new FeeJuicePaymentMethod())
				break;
			case "fjwc":
				if (!selectedMethod.value.claimAmount && claimParameters.value) {
					selectedMethod.value = {
						...selectedMethod.value,
						claimAmount: claimParameters.value.claimAmount,
						claimSecret: claimParameters.value.claimSecret,
						messageLeafIndex: claimParameters.value.messageLeafIndex,
					}
					break;
				}
				if (!selectedMethod.value.claimAmount || !selectedMethod.value.claimSecret || !selectedMethod.value.messageLeafIndex) {
					settings.value = undefined
					break;
				}
				settings.value = new FeeSettings(
					new FeeJuiceWithClaimPaymentMethod(
						selectedMethod.value.claimAmount,
						selectedMethod.value.claimSecret,
						selectedMethod.value.messageLeafIndex,
					),
				)
				break;
			case "fpc":
				if (!selectedMethod.value.fpc && selectedFpc.value) {
					selectedMethod.value = {
						...selectedMethod.value,
						fpc: selectedFpc.value,
						balance: selectedFpc.value.balance,
						inPublic: selectedFpc.value.balance?.privateBalance === "0" && selectedFpc.value.balance?.publicBalance !== "0",
					}
					break;
				}
				if (!selectedMethod.value.fpc) {
					settings.value = undefined
					break;
				}
				switch (selectedMethod.value.fpc.type) {
					case FpcType.DefaultSponsoredFpc:
						settings.value = new FeeSettings(new FpcPaymentMethod(selectedMethod.value.fpc.id))
						break;
					case FpcType.DefaultFpc:
						if (isZeroBalance(selectedMethod.value)) {
							settings.value = undefined
							break;
						}

						settings.value = new FeeSettings(new FpcPaymentMethod(selectedMethod.value.fpc.id, selectedMethod.value.inPublic))
						break;
					default:
						break;
				}
				break;
			default:
				break;
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
				balance: selectedFpc.value.balance,
				inPublic: selectedFpc.value.balance?.privateBalance === "0" && selectedFpc.value.balance?.publicBalance !== "0",
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
	await init()
})
onBeforeUnmount(() => {
	cacheStore.feePaymentMethods = cacheStore.feePaymentMethods.filter(m => m.id !== methodId)
	fpcService.dispose()
	tokenBalanceService.dispose()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex align="center" justify="between" :class="$style.card">
			<Text size="13" weight="600" color="primary">Pay fee with</Text>

			<Text v-if="isCustomMethod" size="13" weight="600" color="primary"> Custom method </Text>
			<Dropdown v-else @onOpen="isMethodsDropdownOpen = true" @onClose="isMethodsDropdownOpen = false">
				<template #trigger>
					<Spinner v-if="loading" color="--txt-primary" />
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
						:key="`${method.type}:${method.balance?.id}`"
						@click="selectedMethod = method"
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
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> Available </Text>
				<Text size="12" weight="600" :color="isZeroBalance(selectedMethod) ? 'red' : 'primary'">
					{{ feeJuiceBalance?.publicBalance ?? "0" }} Fee Juice
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
				<Flex @click="handleFillClaimParameters" :style="{ cursor: 'pointer'}">
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
							:class="$style.icon_btn"
						/>
					</Flex>
				</Flex>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type ==='fpc'">
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> FPC </Text>

				<Flex @click="handleSelectFPC" :style="{ cursor: 'pointer'}">
					<Text v-if="!selectedMethod.fpc" size="13" weight="600" color="red" :style="{paddingRight: '8px'}"> Select FPC </Text>
					<Text v-else size="12" weight="600" color="primary"> {{ selectedMethod.fpc.name || trimAddress(selectedMethod.fpc.address) }} </Text>
				</Flex>
			</Flex>
			<template v-if="selectedMethod.fpc && selectedMethod.fpc?.type === FpcType.DefaultFpc">
				<Flex align="center" justify="between" :class="$style.fjc_price" :style="{padding: '6px 12px'}">
					<Text size="12" weight="600" color="secondary"> Visibility </Text>

					<Flex
						@click="selectedMethod.inPublic ? selectedMethod.inPublic = false : selectedMethod.inPublic = true"
						align="center"
						gap="6"
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
				<Flex align="center" justify="between" :class="$style.fjc_price">
					<Text size="12" weight="600" color="secondary"> Available </Text>
					<Text size="12" weight="600" :color="isZeroBalance(selectedMethod) ? 'red' : 'primary'">
						{{ formatBalance(selectedMethod.fpc.balance, selectedMethod.inPublic) }}
						{{ selectedMethod.fpc.balance.token.symbol }}
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
</style>
