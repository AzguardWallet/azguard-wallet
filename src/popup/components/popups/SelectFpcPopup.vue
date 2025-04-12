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
})

let fpcService = null
let tokenBalanceService = null
const fpcs = ref([])
const balances = ref([])

const isLoading = ref(false)

const handleSelectFpc = (fpc) => {
	cacheStore.selectedFpc = fpc
	emit("onClose")
}

const prepareFpc = (fpc) => {
	return fpc.type === FpcType.DefaultSponsoredFpc
		? {
			...fpc,
			color: getNetworkColor(appStore.network.chainId),
		}
		: {
			...fpc,
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
			isLoading.value = true

			fpcService = new FpcServiceClient(undefined, undefined, onFpcAdded, onFpcUpdated, onFpcDeleted)
			tokenBalanceService = new TokenBalanceServiceClient(undefined, undefined, onBalanceUpdate, onBalanceUpdate, onBalanceUpdate)
			balances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)
			fpcs.value = (await fpcService.getFpcs(appStore.network.chainId)).map(f => prepareFpc(f))

			isLoading.value = false
		}
	}
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx=popupStore.popups.select_fpc>
		<PopupCard>
			<Flex
				wide
				direction="column"
				justify="between"
				gap="16"
				:class="$style.wrapper"
			>
				<Flex direction="column" gap="16">
					<Flex align="center" justify="start">
						<Text size="14" weight="600" color="primary">
							Select FPC
						</Text>
					</Flex>
					<Flex direction="column" gap="6">
						<Flex
							v-for="fpc in fpcs"
							@click="handleSelectFpc(fpc)"
							align="center"
							justify="between"
							gap="12"
							:class="$style.fpc"
						>
							<Flex align="center" gap="10" wide>
								<Icon
									:name="
										cacheStore.selectedFpc?.id === fpc.id
											? 'check-circle'
											: 'fpc'
									"
									size="16"
									:color="
										cacheStore.selectedFpc?.id === fpc.id
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

.badge {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);
}
</style>
