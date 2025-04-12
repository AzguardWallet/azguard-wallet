<route lang="json">
{
	"meta": {
		"title": "Manage fpcs",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
// import { Dropdown, DropdownDivider, DropdownItem } from "../../../../components/ui/Dropdown"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

/** Utils */
import { getNetworkColor } from "@/components/ui/utils.js"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const fpcs = ref([])
const balances = ref([])
const tokens = computed(() => new Map(balances.value?.map(b => [b.token.contract, b.token])))
const tokenContracts = computed(() => new Set(tokens.value?.keys()))
const isLoading = ref(false)
const prepareFpc = (fpc) => {
	return fpc.type === FpcType.DefaultSponsoredFpc
		? {
			...fpc,
			color: getNetworkColor(appStore.network.chainId),
		}
		: {
			...fpc,
			color: "green",
			token: tokens.value?.get(fpc.asset),
		}
}
const fetchFpcs = async () => {
	isLoading.value = true
	
	try {
		const allFpcs = await fpcService.getFpcs(appStore.network.chainId)
		balances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)

		fpcs.value = allFpcs
			// .filter(f => f.type === FpcType.DefaultSponsoredFpc || (f.type === FpcType.DefaultFpc && tokenContracts.value?.has(f.asset)))
			.map(f => prepareFpc(f))
	} catch (err) {
		console.log(err);
	} finally {
		isLoading.value = false
	}
}

const handleCopyAddress = (address) => {
	window.navigator.clipboard.writeText(address)
	openToast({ label: "FPC's address is copied", icon: "copy" })
}

const handleEdit = target => {
	cacheStore.fpcToEditIdx = target.id
	popupStore.open("edit_fpc")
}

const handleDelete = target => {
	cacheStore.confirm.confirm_text = "Yes, delete FPC"
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.title = "Delete this FPC?"
	cacheStore.confirm.description =
		"By confirming this action, the selected FPC will be permanently deleted from your wallet"
	cacheStore.confirm.callback = async () => {
		await fpcService.deleteFpc(target.id)

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

const onBalanceUpdated = () => {}
const fpcService = new FpcServiceClient(undefined, undefined, onFpcAdded, onFpcUpdated, onFpcDeleted)
const tokenBalanceService = new TokenBalanceServiceClient(undefined, undefined,	onBalanceUpdated, onBalanceUpdated, onBalanceUpdated)
watch(
	() => [appStore.network, appStore.account],
	() => {
		if (appStore.network && appStore.account) fetchFpcs()
	},
)
onMounted(() => {
	if (appStore.network && appStore.account) fetchFpcs()
})
onBeforeUnmount(() => {
	fpcService.dispose()
	tokenBalanceService.dispose()
})
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="16">
			<Text size="13" weight="600" color="primary">
				FPCs &nbsp;<Text color="tertiary">{{ fpcs.length }} </Text>
			</Text>

			<ItemsContainer>
				<SettingItem
					v-for="fpc in fpcs"
					@click="handleCopyAddress(fpc.address)"
					:title="fpc.name || fpc.address"
					:description="fpc.name ? fpc.address : null"
					iconBgColor="transparent"
				>
					<template #right>
						<Flex
							align="center"
							gap="6"
							:class="$style.badge"
							:style="{ background: `var(--${fpc.color})` }"
						>
							<Text size="11" weight="700"> {{ fpc.token?.symbol || 'Sponsored' }} </Text>
						</Flex>

						<Flex align="center" gap="8">
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
			</ItemsContainer>

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
		</Flex>

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

.badge {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);
}

.icon_btn {
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
