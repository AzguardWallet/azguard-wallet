<script setup>
/** Components */
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

/** Utils */
import { getNetworkColor } from "@/components/ui/utils.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
	payload: Object,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_fpc?.order
})

let fpcService = null
let tokenBalanceService = null
const selectedFpc = ref()
const fpcs = ref([])
const balances = ref([])
const tokenContracts = computed(() => new Set(balances.value?.map(b => b.token?.contract)))
const showSearchInput = ref(false)
const searchTerm = ref()
const filteredFpcs = computed(() => {
	const lowTerm = searchTerm.value?.toLowerCase() || ""
	if (!lowTerm) return fpcs.value

	return fpcs.value.filter(fpc => {
		return (
			fpc.name?.toLowerCase().includes(lowTerm) ||
			fpc.typeName?.toLowerCase().includes(lowTerm) ||
			fpc.balance?.token?.name?.toLowerCase().includes(lowTerm) ||
			fpc.balance?.token?.symbol?.toLowerCase().includes(lowTerm) ||
			fpc.address  === searchTerm.value ||
			fpc.asset === searchTerm.value
		)
	})
})

const isLoading = ref(false)
const error = ref()
const init = async () => {
	isLoading.value = true
	error.value = ""

	try {
		fpcService = new FpcServiceClient(undefined, undefined, onFpcAdded, onFpcUpdated, onFpcDeleted)
		tokenBalanceService = new TokenBalanceServiceClient(undefined, undefined, onBalanceUpdate, onBalanceUpdate, onBalanceUpdate)
		balances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)
		const tokenContracts = new Set(balances.value?.map(b => b.token?.contract))
		const allFpcs = await fpcService.getFpcs(appStore.network.chainId)
		fpcs.value = allFpcs
			.filter(f => f.type === FpcType.DefaultSponsoredFpc || (f.type === FpcType.DefaultFpc && tokenContracts?.has(f.asset)))
			.map(f => prepareFpc(f))
	}
	catch (err) {
		error.value = err
	}
	finally {
		isLoading.value = false
	}
}

const handleSelectFpc = (fpc) => {
	const methodIx = cacheStore.feePaymentMethods.findIndex(m => m.id === props.payload?.id)
	if (methodIx === -1) {
		cacheStore.feePaymentMethods.push({
			id: props.payload?.id,
			fpc: fpc,
		})
	} else {
		cacheStore.feePaymentMethods[methodIx].fpc = fpc
	}
	emit("onClose")
}

const prepareFpc = (fpc) => {
	return fpc.type === FpcType.DefaultSponsoredFpc
		? {
			...fpc,
			typeName: "sponsored",
			color: getNetworkColor(appStore.network.chainId),
		}
		: {
			...fpc,
			typeName: "fpc",
			color: "green",
			balance: balances.value.find(b => b.token.contract === fpc.asset),
		}
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
const onBalanceUpdate = () => {}
watch(
	() => props.show,
	async () => {
		if (props.show) {
			selectedFpc.value = cacheStore.feePaymentMethods.find(m => m.id === props.payload?.id)?.fpc
			await init()
		}
	}
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx=popupStore.popups.select_fpc?.order>
		<PopupCard :displaceIdx>
			<Flex
				wide
				direction="column"
				justify="between"
				gap="16"
				:class="$style.wrapper"
			>
				<Flex direction="column" gap="16">
					<Flex align="center" justify="between" gap="16">
						<Text size="14" weight="600" color="primary">
							Select FPC
						</Text>

						<Tooltip position="end">
							<Icon
								@click="showSearchInput = !showSearchInput"
								name="search"
								size="14"
								color="secondary"
								:class="[$style.search_icon, showSearchInput && $style.active]"
							/>

							<template #content>
								<Text v-if="!showSearchInput" size="12" color="secondary"> Show search field </Text>
								<Text v-else size="12" color="secondary"> Hide search field </Text>
							</template>
						</Tooltip>
					</Flex>

					<Input
						v-if="showSearchInput"
						v-model="searchTerm"
						icon="search"
						placeholder="Search by name, type, address or token"
					/>
				</Flex>

				<Banner v-if="isLoading" isLoading> Fetching FPCs </Banner>

				<Tooltip v-else-if="error" wide>
					<Banner :action="{ name: 'Try again', callback: () => init() }" variant="error" wide>
						Something went wrong
					</Banner>

					<template #content>
						{{ error }}
					</template>
				</Tooltip>

				<Flex v-else direction="column" gap="6">
					<Flex
						v-for="fpc in filteredFpcs"
						@click="handleSelectFpc(fpc)"
						align="center"
						justify="between"
						gap="12"
						:class="$style.fpc"
					>
						<Flex align="center" gap="10" wide>
							<Icon
								:name="
									selectedFpc?.id === fpc.id
										? 'check-circle'
										: 'circle'
								"
								size="16"
								:color="
									selectedFpc?.id === fpc.id
										? 'green'
										: 'tertiary'
								"
							/>

							<Flex direction="column" gap="4" wide>
								<Text size="14" weight="600" color="primary" :class="$style.title">
									{{ fpc.name || fpc.address }}
								</Text>
								<Text v-if="fpc.name" size="13" weight="600" color="tertiary" :class="$style.description">
									{{ fpc.address }}
								</Text>
							</Flex>
						</Flex>

						<Flex
							align="center"
							gap="6"
							:class="$style.badge"
							:style="{ background: `var(--${fpc.color})` }"
						>
							<Text size="11" weight="700"> {{ fpc.balance?.token?.symbol || 'Sponsored' }} </Text>
						</Flex>
					</Flex>

					<Flex v-if="filteredFpcs.length === 0" align="center" justify="center" gap="8">
						<Text size="13" weight="600" color="tertiary"> No FPCs found </Text>
					</Flex>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;

	padding: 0 20px 24px 20px;
}

.fpc {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	min-height: 58px;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered),
			0 1px 2px var(--shadow-5);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.title {
	min-width: 100%;
	width: 0;

	line-height: 16px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.description {
	min-width: 100%;
	width: 0;

	line-height: 14px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
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
}
</style>
