<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"
import { OriginType } from "@/wallet/services/transaction/client"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { trimAddress } from "@/utils/string"

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

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.tx?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const tokenService = new TokenServiceClient()

const tx = computed(() => appStore.transactions.find(t => t.hash === cacheStore.activeTxHash))
const call = computed(() => tx.value.calls.at(1)?.method?.startsWith("mint") ? tx.value.calls[1] : tx.value.calls[0])
const type = computed(() => {
	if (call.value?.method.startsWith("transfer")) return "transfer"
	if (call.value?.method.startsWith("mint_to_")) return "mint"
	return "tx"
})

const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const tokens = ref([])
const token = computed(() => tokens.value.find(t => call.value?.contract === t.contract))

const transferAmount = computed(() => {
	if (transfer.value) {
		const decimals = new BN(10).pow(token.value?.decimals || 0)
		return balanceFormatted(new BN((transfer.value.amount || 0)).dividedBy(decimals), 8).value
	}
	
	return 0
})

const mintAmount = computed(() => {
	if (type.value !== "mint") return 0
	
	const decimals = new BN(10).pow(tx.value?.origin?.type === OriginType.UI ? 8 : 0)
	let amount = new BN(0)
	for (const c of tx.value.calls) {
		amount = amount.plus(new BN(c.args.at(-1) || 0))
	}

	return balanceFormatted(amount.dividedBy(decimals), 8).value
})

watch(
	() => props.show,
	async () => {
		if (props.show) {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
		} else {
			tokenService.disconnect()
		}
	},
)

const txTime = computed(() => {
	if (!tx.value?.updatedAt) return null
	return DateTime.fromMillis(tx.value.updatedAt).toFormat("MMM dd, yyyy 'at' HH:mm")
})

const handleCopy = (target) => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Successfully copied", icon: "copy" })
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.tx?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" align="center" gap="32" :class="$style.wrapper">
				<Flex direction="column" align="center" gap="12">
					<Flex align="center" gap="6">
						<Icon name="zap-circle" size="16" color="primary" />
						<Text size="16" weight="600" color="primary" style="transform: translate3d(0, 0, 0, 0)">
							Transaction
						</Text>
					</Flex>

					<Flex align="center" gap="8">
						<Flex @click="handleCopy(tx.hash)" align="center" gap="6" class="copyable">
							<Text size="12" weight="600" color="tertiary">
								{{ tx.hash.slice(0, 4) }}
								<Text color="dark">•••</Text>
								{{ tx.hash.slice(-4) }}
							</Text>
							<Icon name="copy" size="12" color="tertiary" />
						</Flex>
						<Text v-if="txTime" size="12" weight="500" color="tertiary">
							{{ txTime }}
						</Text>
					</Flex>
				</Flex>

				<Flex v-if="transferAmount" align="center" direction="column" gap="8">
					<Text size="24" weight="500" color="primary">
						{{ transferAmount }}
						<Text color="tertiary">{{ transfer.token.symbol }}</Text>
					</Text>
					<Text size="12" weight="500" color="tertiary"> Transfer Amount </Text>
				</Flex>

				<Flex v-else-if="mintAmount" align="center" direction="column" gap="8">
					<Text size="24" weight="500" color="primary">
						{{ mintAmount }}
						<Text v-if="token" color="tertiary">{{ token.symbol }}</Text>
					</Text>
					<Text size="12" weight="500" color="tertiary"> Mint Amount </Text>
				</Flex>

				<Banner
					v-if="transfer && !token"
					variant="warning"
					direction="vertical"
					:action="{ name: 'Copy token address', callback: () => handleCopy(call.contract) }"
					wide
				>
					<template #title> {{ transfer.token.symbol }} is missing </template>
					<template #description> This token not found in your token list </template>
				</Banner>

				<Flex v-if="transfer" wide gap="4">
					<Flex wide align="center" gap="12" :class="[$style.item, $style.left]">
						<Flex @click="handleCopy(transfer.from)" wide direction="column" gap="4" class="copyable">
							<AddressDisplay @onAddressClick="handleCopy(transfer.from)" size="13" weight="600" :address="transfer.from" :formatter="(addr) => trimAddress(addr, 6, 4)" />
							<Text size="12" weight="500" color="tertiary"> From </Text>
						</Flex>

						<Icon
							:name="['transfer', 'transfer_to_public'].includes(call?.method) ? 'key-square' : 'face'"
							size="16"
							:color="['transfer', 'transfer_to_public'].includes(call?.method) ? 'green' : 'orange'"
						/>
					</Flex>

					<Flex wide align="center" gap="12" :class="[$style.item, $style.right]">
						<Flex @click="handleCopy(transfer.to)" wide direction="column" gap="4" class="copyable">
							<AddressDisplay @onAddressClick="handleCopy(transfer.to)" size="13" weight="600" :address="transfer.to" :formatter="(addr) => trimAddress(addr, 6, 4)" />
							<Text size="12" weight="500" color="tertiary"> Destination </Text>
						</Flex>

						<Icon
							:name="['transfer', 'transfer_to_private'].includes(call?.method) ? 'key-square' : 'face'"
							size="16"
							:color="['transfer', 'transfer_to_private'].includes(call?.method) ? 'green' : 'orange'"
						/>
					</Flex>
				</Flex>

				<Button @click="emit('onClose')" wide type="secondary" size="small"> Close </Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.item {
	background: var(--gray-5);

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&.left {
		border-radius: 8px 4px 4px 8px;
	}

	&.right {
		border-radius: 4px 8px 8px 4px;
	}
}
</style>
