<script setup lang="ts">
/** Vendor */
import BigNumber from "bignumber.js"

/** Components */
import { Dropdown, DropdownDivider, DropdownItem } from "../../../../components/ui/Dropdown"

/** Services */
import { Profile } from "../../../../wallet/services/profile/client"
import { Network } from "../../../../wallet/services/network/client"
import { Account } from "../../../../wallet/services/account/client"
import {
	FeeJuicePaymentMethod,
	FeeJuiceWithClaimPaymentMethod,
	FeePaymentMethodType,
	FeeSettings,
	FpcPaymentMethod,
} from "../../../../wallet/services/execution/client"
import { FpcInfo, FpcServiceClient, FpcType } from "../../../../wallet/services/fpc/client"
import { TokenBalanceInfo, TokenBalanceServiceClient } from "../../../../wallet/services/token-balance/client"

const props = defineProps<{
	profile: Profile
	network: Network
	account: Account
}>()

const settings = defineModel<FeeSettings | undefined>()
const isCustomMethod = computed(() => settings.value?.paymentMethod.type === FeePaymentMethodType.Custom)

const onFpcAdded = async (fpc: FpcInfo) => {
	if (fpc.profileId !== props.profile?.id || fpc.chainId !== props.network?.chainId) {
		return
	}
	const method =
		fpc.type === FpcType.DefaultSponsoredFpc
			? methods.value.find(x => x.type === "sfpc")
			: methods.value.find(x => x.type === "fpc" && x.balance?.token.contract === fpc.asset)

	if (method) {
		method.fpcs!.push(fpc)
		method.fpc ??= fpc
	} else if (fpc.type === FpcType.DefaultSponsoredFpc) {
		addSponsoredFpcMethod([fpc])
	} else if (fpc.type === FpcType.DefaultFpc && !!fpc.asset) {
		const allBalances = await tokenBalanceService.getTokenBalances(undefined, props.account.address)
		const balance = allBalances.find(x => x.token.contract === fpc.asset)
		if (balance) {
			addFpcMethod([fpc], balance)
		}
	}
}
const onFpcUpdated = (fpc: FpcInfo) => {
	if (fpc.profileId !== props.profile?.id || fpc.chainId !== props.network?.chainId) {
		return
	}
	const method = methods.value.find(x => x.fpcs!.find(f => f.id === fpc.id))
	if (method) {
		const index = method.fpcs!.findIndex(x => x.id === fpc.id)
		if (method.fpcs![index].asset !== fpc.asset) {
			onFpcDeleted(method.fpcs![index])
			onFpcAdded(fpc)
		} else {
			method.fpcs![index] = fpc
			if (method.fpc?.id === fpc.id) {
				method.fpc = fpc
			}
		}
	}
}
const onFpcDeleted = (fpc: FpcInfo) => {
	if (fpc.profileId !== props.profile?.id || fpc.chainId !== props.network?.chainId) {
		return
	}
	const method =
		fpc.type === FpcType.DefaultSponsoredFpc
			? methods.value.find(x => x.type === "sfpc")
			: methods.value.find(x => x.type === "fpc" && x.balance?.token.contract === fpc.asset)

	if (method) {
		method.fpcs = method.fpcs!.filter(x => x.id !== fpc.id)
		if (method.fpc?.id === fpc.id) {
			method.fpc = method.fpcs.at(0)
		}
		if (!method.fpcs.length) {
			methods.value = methods.value.filter(x => x !== method)
			if (selectedMethod.value === method) {
				selectedMethod.value = undefined
			}
		}
	}
}
const onBalanceAdded = async (balance: TokenBalanceInfo) => {
	if (balance.account !== props.account?.address) {
		return
	}
	if (isFeeJuice(balance)) {
		methods.value[0].balance = balance
		methods.value[1].balance = balance
	} else {
		const fpcs = (await fpcService.getFpcs(props.account.chainId)).filter(x => x.asset === balance.token.contract)
		if (fpcs.length) {
			addFpcMethod(fpcs, balance)
		}
	}
}
const onBalanceUpdated = (balance: TokenBalanceInfo) => {
	if (balance.account !== props.account?.address) {
		return
	}
	const method = methods.value.find(x => x.balance?.id === balance.id)
	if (method) {
		method.balance = balance
	}
}
const onBalanceDeleted = (balance: TokenBalanceInfo) => {
	if (balance.account !== props.account?.address) {
		return
	}
	if (isFeeJuice(balance)) {
		methods.value[0].balance = undefined
		methods.value[1].balance = undefined
	} else {
		const index = methods.value.findIndex(x => x.balance?.id === balance.id)
		if (index !== -1) {
			methods.value.splice(index, 1)
			if (selectedMethod.value?.balance?.id === balance.id) {
				selectedMethod.value = undefined
			}
		}
	}
}
const fpcService = new FpcServiceClient(undefined, undefined, onFpcAdded, onFpcUpdated, onFpcDeleted)
const tokenBalanceService = new TokenBalanceServiceClient(
	undefined,
	undefined,
	onBalanceAdded,
	onBalanceUpdated,
	onBalanceDeleted,
)

const loading = ref<boolean>(false)
const error = ref<string | undefined>()

type FeeMethod = {
	type: "fj" | "fjwc" | "sfpc" | "fpc"
	title: string
	balance?: TokenBalanceInfo
	fpcs?: FpcInfo[]
	// inputs
	fpc?: FpcInfo
	inPublic?: boolean
	claimAmount?: string
	claimSecret?: string
	messageLeafIndex?: string
}
const methods = ref<Array<FeeMethod>>([])
const selectedMethod = ref<FeeMethod | undefined>()

const addSponsoredFpcMethod = (fpcs: FpcInfo[]) => {
	methods.value.splice(2, 0, {
		type: "sfpc",
		title: "Sponsored FPC",
		fpcs: fpcs,
		fpc: fpcs.at(0),
	})
}
const addFpcMethod = (fpcs: FpcInfo[], balance: TokenBalanceInfo) => {
	methods.value.push({
		type: "fpc",
		title: `$${balance.token.symbol}`,
		balance,
		fpcs,
		fpc: fpcs.at(0),
		inPublic: balance.privateBalance === "0" && balance.publicBalance !== "0",
	})
}

const init = async () => {
	try {
		loading.value = true
		methods.value = [
			{
				type: "fj",
				title: "Fee Juice",
			},
			{
				type: "fjwc",
				title: "Fee Juice with claim",
			},
		]

		if (props.network && props.account) {
			const allFpcs = await fpcService.getFpcs(props.network.chainId)
			const allBalances = await tokenBalanceService.getTokenBalances(undefined, props.account.address)

			const feeJuiceBalance = allBalances.find(isFeeJuice)
			methods.value[0].balance = feeJuiceBalance
			methods.value[1].balance = feeJuiceBalance

			const sponsoredFpcs = allFpcs.filter(x => x.type === FpcType.DefaultSponsoredFpc)
			if (sponsoredFpcs.length) {
				addSponsoredFpcMethod(sponsoredFpcs)
			}

			const fpcAssets = new Set(
				allFpcs.filter(x => x.type === FpcType.DefaultFpc && !!x.asset).map(x => x.asset!),
			)
			for (const balance of allBalances.filter(x => fpcAssets.has(x.token.contract))) {
				const fpcs = allFpcs.filter(fpc => fpc.asset === balance.token.contract)
				addFpcMethod(fpcs, balance)
			}
		}
	} catch (e) {
		console.error("Failed to init FPCs", e)
		error.value = (e as Error)?.message ?? e
	} finally {
		loading.value = false
	}
}

watchEffect(() => {
	const method = selectedMethod.value
	switch (method?.type) {
		case "fj": {
			if (isZeroBalance(method)) {
				settings.value = undefined
				break
			}
			settings.value = new FeeSettings(new FeeJuicePaymentMethod())
			break
		}
		case "fjwc": {
			if (!method.claimAmount || !method.claimSecret || !method.messageLeafIndex) {
				settings.value = undefined
				break
			}
			settings.value = new FeeSettings(
				new FeeJuiceWithClaimPaymentMethod(method.claimAmount, method.claimSecret, method.messageLeafIndex),
			)
			break
		}
		case "sfpc": {
			if (!method.fpc) {
				settings.value = undefined
				break
			}
			settings.value = new FeeSettings(new FpcPaymentMethod(method.fpc.id))
			break
		}
		case "fpc": {
			if (!method.fpc || isZeroBalance(method)) {
				settings.value = undefined
				break
			}
			settings.value = new FeeSettings(new FpcPaymentMethod(method.fpc.id, method.inPublic))
			break
		}
	}
})

onBeforeMount(async () => {
	await init()
})

onBeforeUnmount(() => {
	fpcService.dispose()
	tokenBalanceService.dispose()
})

watch(
	() => [props.profile, props.network, props.account],
	async () => {
		await init()
	},
)

const isFeeJuice = (tb: TokenBalanceInfo) => {
	return tb.token.contract === "0x0000000000000000000000000000000000000000000000000000000000000005"
}

const isZeroBalance = (method: FeeMethod) => {
	return ((method.inPublic ? method.balance?.publicBalance : method.balance?.privateBalance) ?? "0") === "0"
}

const formatBalance = (tb: TokenBalanceInfo, inPublic?: boolean) => {
	let amount = new BigNumber((inPublic ? tb.publicBalance : tb.privateBalance) ?? "0")
	amount = amount.div(new BigNumber("1" + "0".repeat(tb.token.decimals)))
	return amount.toFormat()
}

const trimAddress = (address: string) => {
	return `${address.substring(0, 8)}..${address.substring(62)}`
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex align="center" justify="between" :class="$style.card">
			<Text size="13" weight="600" color="primary">Pay fee with</Text>

			<Text v-if="isCustomMethod" size="13" weight="600" color="primary"> Custom method </Text>
			<Dropdown v-else :disabled="loading || error">
				<template #trigger>
					<Spinner v-if="loading" color="--txt-primary" />
					<Flex v-else align="center" gap="8" class="clickable">
						<template v-if="selectedMethod">
							<Icon name="discount" size="16" color="purple" />
							<Text size="13" weight="600" color="primary">
								{{ selectedMethod.title }}
							</Text>
						</template>
						<template v-else>
							<Text size="13" weight="600" color="red" style="padding: 2px 0"> Select method </Text>
						</template>
						<Icon name="chevron" size="12" color="secondary" />
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

					<DropdownDivider />

					<DropdownItem @click="">
						<Flex align="center" gap="8">
							<Icon name="plus-circle" size="16" color="primary" />
							<Text size="13" weight="600" color="primary"> Add FPC </Text>
						</Flex>
					</DropdownItem>
				</template>
			</Dropdown>
		</Flex>

		<template v-if="error">
			<Flex align="center" justify="between" :class="$style.card">
				<Text size="12" weight="600" color="red">{{ error }}</Text>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type === 'fj'">
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> Available </Text>
				<Text size="12" weight="600" :color="isZeroBalance(selectedMethod) ? 'red' : 'primary'">
					{{ selectedMethod.balance?.publicBalance ?? "0" }} Fee Juice
				</Text>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type === 'fjwc'">
			<Flex wide direction="column" gap="20" :class="$style.card">
				<Input label="Claim amount" placeholder="Enter claim amount" v-model="selectedMethod.claimAmount" />
				<Input label="Claim secret" placeholder="Enter claim secret" v-model="selectedMethod.claimSecret" />
				<Input
					label="Message leaf index"
					placeholder="Enter message leaf index"
					v-model="selectedMethod.messageLeafIndex"
				/>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type === 'sfpc'">
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> FPC </Text>
				<Dropdown>
					<template #trigger>
						<Flex align="center" gap="8" class="clickable">
							<Text v-if="selectedMethod!.fpc" size="13" weight="600" color="primary">
								{{ selectedMethod.fpc.name ?? trimAddress(selectedMethod.fpc.address) }}
							</Text>
							<Text v-else size="13" weight="600" color="red"> Select FPC </Text>
							<Icon name="chevron" size="12" color="secondary" />
						</Flex>
					</template>

					<template #popup>
						<DropdownItem
							v-for="fpc in selectedMethod!.fpcs ?? []"
							:key="fpc.id"
							@click="selectedMethod.fpc = fpc"
						>
							<Flex align="center" gap="8">
								<Text size="13" weight="600" color="primary">
									{{ fpc.name ?? trimAddress(fpc.address) }}
								</Text>
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
		</template>
		<template v-else-if="selectedMethod?.type === 'fpc'">
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> FPC </Text>
				<Dropdown>
					<template #trigger>
						<Flex align="center" gap="8" class="clickable">
							<Text v-if="selectedMethod!.fpc" size="13" weight="600" color="primary">
								{{ selectedMethod.fpc.name ?? trimAddress(selectedMethod.fpc.address) }}
							</Text>
							<Text v-else size="13" weight="600" color="red"> Select FPC </Text>
							<Icon name="chevron" size="12" color="secondary" />
						</Flex>
					</template>

					<template #popup>
						<DropdownItem
							v-for="fpc in selectedMethod!.fpcs ?? []"
							:key="fpc.id"
							@click="selectedMethod.fpc = fpc"
						>
							<Flex align="center" gap="8">
								<Text size="13" weight="600" color="primary">
									{{ fpc.name ?? trimAddress(fpc.address) }}
								</Text>
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> Visibility </Text>
				<Dropdown>
					<template #trigger>
						<Flex align="center" gap="8" class="clickable">
							<Text size="13" weight="600" color="primary">
								{{ selectedMethod!.inPublic ? "Public" : "Private" }}
							</Text>
							<Icon name="chevron" size="12" color="secondary" />
						</Flex>
					</template>

					<template #popup>
						<DropdownItem @click="selectedMethod.inPublic = false">
							<Flex align="center" gap="8">
								<Text size="13" weight="600" color="primary"> Private </Text>
							</Flex>
						</DropdownItem>
						<DropdownItem @click="selectedMethod.inPublic = true">
							<Flex align="center" gap="8">
								<Text size="13" weight="600" color="primary"> Public </Text>
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
			<Flex align="center" justify="between" :class="$style.fjc_price">
				<Text size="12" weight="600" color="secondary"> Available </Text>
				<Text size="12" weight="600" :color="isZeroBalance(selectedMethod) ? 'red' : 'primary'">
					{{ formatBalance(selectedMethod!.balance!, selectedMethod.inPublic) }}
					{{ selectedMethod.balance!.token.symbol }}
				</Text>
			</Flex>
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
</style>
