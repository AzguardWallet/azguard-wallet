<route lang="json">
{
	"meta": {
		"title": "Manage FPCs",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

/** Utils */
import { getChainColor } from "@/components/ui/utils.js"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const FEE_METHOD_LS_KEY = "azguard:ui:feePaymentMethods"

const fpcs = ref([])
const balances = ref([])
const tokens = computed(() => new Map(balances.value?.map(b => [b.token.contract, b.token])))
const tokenContracts = computed(() => new Set(tokens.value?.keys()))
const isLoading = ref(false)
const error = ref()

const showSearchInput = ref(false)
const searchTerm = ref()
const showAllFpcs = ref(true)
const filteredFpcs = computed(() => {
	let arr = [...fpcs.value]
	if (!showAllFpcs.value) {
		arr = arr.filter(f => f.type === FpcType.DefaultSponsoredFpc || (f.type === FpcType.DefaultFpc && tokenContracts.value?.has(f.asset)))
	}
	const lowTerm = searchTerm.value?.toLowerCase() || ""
	if (!lowTerm) return arr

	return arr.filter(fpc => {
		return (
			fpc.name?.toLowerCase().includes(lowTerm) ||
			fpc.typeName?.toLowerCase().includes(lowTerm) ||
			fpc.token?.name?.toLowerCase().includes(lowTerm) ||
			fpc.token?.symbol?.toLowerCase().includes(lowTerm) ||
			fpc.address  === searchTerm.value ||
			fpc.asset === searchTerm.value
		)
	})
})

const getFPCBadgeTitle = (fpc) => {
	if (fpc.type === FpcType.DefaultSponsoredFpc) return "Sponsored"
	if (fpc.token?.symbol) {
		if (fpc.token?.symbol.length > 6) {
			return `${fpc.token?.symbol.slice(0, 6)}...`
		}

		return fpc.token.symbol
	}
	
	return ""
}
const prepareFpc = (fpc) => {
	return fpc.type === FpcType.DefaultSponsoredFpc
		? {
			...fpc,
			typeName: "sponsored",
			color: getChainColor(appStore.network.chainId),
		}
		: {
			...fpc,
			typeName: "fpc",
			color: "green",
			token: tokens.value?.get(fpc.asset),
		}
}
const fetchFpcs = async () => {
	isLoading.value = true
	
	try {
		const allFpcs = await fpcService.getFpcs(appStore.network.chainId)
		balances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)
		fpcs.value = allFpcs ? allFpcs.map(f => prepareFpc(f)) : []
	} catch (err) {
		error.value = err
	} finally {
		isLoading.value = false
	}
}

const handleCopyAddress = (address) => {
	window.navigator.clipboard.writeText(address)
	openToast({ label: "FPC's address is copied", icon: "copy" })
}

const handleAddToken = (fpc) => {
	cacheStore.preselectedTokenAddressToAdd = fpc.asset
	popupStore.open("new_token")
}
const handleEdit = (fpc) => {
	cacheStore.fpcToEditIdx = fpc.id
	popupStore.open("edit_fpc")
}
const handleDelete = (fpc) => {
	cacheStore.confirm.confirm_text = "Yes, delete FPC"
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.title = "Delete this FPC?"
	cacheStore.confirm.description =
		"By confirming this action, the selected FPC will be permanently deleted from your wallet"
	cacheStore.confirm.callback = async () => {
		await fpcService.deleteFpc(fpc.id)

		const fpms = (await chrome.storage.local.get(FEE_METHOD_LS_KEY))[FEE_METHOD_LS_KEY] || {}
		if (Object.keys(fpms).length) {
			for (const [account, data] of Object.entries(fpms)) {
				if (data.fpc?.id === fpc.id) {
					delete fpms[account]
				}
			}

			await chrome.storage.local.set({ [FEE_METHOD_LS_KEY]: fpms })
		}

		openToast({ label: "FPC is deleted" })
	}

	popupStore.open("confirm")
}

const onFpcAdded = (fpc) => {
	fpcs.value.push(prepareFpc(fpc))
}
const onFpcUpdated = (fpc) => {
	const idx = fpcs.value.findIndex(f => f.id === fpc.id)

	if (idx === -1) return
	fpcs.value[idx] = prepareFpc(fpc)
}
const onFpcDeleted = (fpc) => {
	fpcs.value = fpcs.value.filter(f => f.id !== fpc.id)
}
const onBalanceAdded = (balance) => {
	balances.value.push(balance)

	fpcs.value = fpcs.value.map(f => {
		if (f.asset === balance.token.contract) {
			return prepareFpc({
				...f,
				token: balance.token,
			})
		}
		return f
	})
}
const onBalanceUpdated = (balance) => {
	const balanceIdx = balances.value.findIndex(b => b.token.contract === balance.token.contract)
	if (balanceIdx === -1) return
	balances.value[balanceIdx] = balance
}
const onBalanceDeleted = (balance) => {
	balances.value = balances.value.filter(b => b.token.contract !== balance.token.contract)
	fpcs.value = fpcs.value.map(f => {
		if (f.asset === balance.token.contract) {
			return prepareFpc({
				...f,
				token: null,
			})
		}
		return f
	})
}
const fpcService = new FpcServiceClient()
fpcService.onFpcAdded.add(onFpcAdded)
fpcService.onFpcDeleted.add(onFpcDeleted)
fpcService.onFpcUpdated.add(onFpcUpdated)
const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
tokenBalanceService.onTokenBalanceDeleted.add(onBalanceDeleted)
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)
watch(
	() => [appStore.network, appStore.account],
	() => {
		if (appStore.network && appStore.account) fetchFpcs()
	},
)
onMounted(() => {
	fpcService.connect()
	tokenBalanceService.connect()
	if (appStore.network && appStore.account) fetchFpcs()
})
onBeforeUnmount(() => {
	fpcService.disconnect()
	tokenBalanceService.disconnect()
})
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Banner v-if="isLoading" isLoading> Fetching FPCs </Banner>

		<Tooltip v-else-if="error" wide>
			<Banner :action="{ name: 'Try again', callback: () => fetchFpcs() }" variant="error" wide>
				Something went wrong
			</Banner>

			<template #content>
				{{ error }}
			</template>
		</Tooltip>

		<Banner v-else-if="!fpcs.length" wide>
			No FPC found, get started by adding new Fee Payment Contract
		</Banner>

		<Flex v-else direction="column" gap="16">
			<Flex align="center" justify="between" gap="16">
				<Text size="13" weight="600" color="primary">
					FPCs &nbsp;<Text color="tertiary">{{ filteredFpcs.length }} </Text>
				</Text>

				<Flex align="center" gap="8">
					<Tooltip v-if="showAllFpcs" position="end">
						<Icon
							@click="showAllFpcs = !showAllFpcs"
							name="eye"
							size="14"
							color="secondary"
							:class="$style.search_icon"
						/>

						<template #content>
							<Text size="12" color="secondary"> Show only availiable </Text>
						</template>
					</Tooltip>

					<Tooltip v-else position="end">
						<Icon
							@click="showAllFpcs = !showAllFpcs"
							name="eye-off"
							size="14"
							color="secondary"
							:class="$style.search_icon"
						/>

						<template #content>
							<Text size="12" color="secondary"> Show all </Text>
						</template>
					</Tooltip>

					<Tooltip position="end">
						<Icon
							@click="showSearchInput = !showSearchInput"
							name="search"
							size="14"
							color="secondary"
							:class="[$style.search_icon, (showSearchInput || searchTerm) && $style.active]"
						/>

						<template #content>
							<Text v-if="!showSearchInput" size="12" color="secondary"> Show search field </Text>
							<Text v-else size="12" color="secondary"> Hide search field </Text>
						</template>
					</Tooltip>
				</Flex>
			</Flex>

			<Input
				v-if="showSearchInput"
				v-model="searchTerm"
				icon="search"
				placeholder="Search by name, type, address or token"
			/>

			<ItemsContainer v-if="fpcs.length">
				<SettingItem
					v-for="fpc in filteredFpcs"
					size="large"
					:title="fpc.name || fpc.address"
					:description="fpc.name ? fpc.address : null"
					icon="fpc"
					iconBgColor="transparent"
					raw
				>
					<template #right>
						<Flex
							v-if="fpc.type === FpcType.DefaultSponsoredFpc || fpc.token?.symbol"
							align="start"
							:class="$style.badge"
							:style="{ background: `var(--${fpc.color})` }"
						>
							<Text size="11" weight="700"> {{ getFPCBadgeTitle(fpc) }} </Text>
						</Flex>

						<Flex align="center" gap="8">
							<Tooltip v-if="!(fpc.type === FpcType.DefaultSponsoredFpc || fpc.token?.symbol)" position="end" delay="350">
								<Icon
									@click.stop="handleAddToken(fpc)"
									name="banknote"
									size="20"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Add token </template>
							</Tooltip>

							<Tooltip position="end" delay="350">
								<Icon
									@click="handleCopyAddress(fpc.address)"
									name="copy"
									size="14"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Copy FPC address </template>
							</Tooltip>

							<Tooltip position="end" delay="350">
								<Icon
									@click.stop="handleEdit(fpc)"
									name="edit"
									size="14"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Edit FPC </template>
							</Tooltip>

							<Tooltip position="end" delay="350">
								<Icon
									@click.stop="handleDelete(fpc)"
									name="close-circle"
									size="14"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Delete FPC </template>
							</Tooltip>
						</Flex>
					</template>
				</SettingItem>

				<Flex v-if="filteredFpcs.length === 0 && searchTerm" align="center" justify="center" gap="8">
					<Text size="13" weight="600" color="tertiary"> No FPCs found </Text>
				</Flex>
			</ItemsContainer>
		</Flex>

		<Button
			@click="popupStore.open('new_fpc')"
			wide
			type="secondary"
			size="medium"
			leftIcon="plus-circle"
			leftIconColor="primary"
		>
			<Text size="13">New FPC</Text>
		</Button>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.search_icon {
	cursor: pointer;
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}

	&.active {
		fill: var(--blue);
	}
}

.badge {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);
	span {
		line-height: 1.2;
	}
}

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
