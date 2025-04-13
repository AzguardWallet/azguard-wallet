<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

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
	return popupStore.len - popupStore.popups.tx
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const tx = computed(() => appStore.transactions.find(t => t.hash === cacheStore.activeTxHash))
const call = computed(() => tx.value.calls[0])
const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const token = computed(() => appStore.tokens.find(t => call.value?.contract === t.contract))

watch(
	() => props.show,
	() => {
		// console.log(tx.value)
	},
)

const handleCopy = target => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Successfully copied", icon: "copy" })
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.tx">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" align="center" gap="32" :class="$style.wrapper">
				<Flex direction="column" align="center" gap="12">
					<Flex align="center" gap="6">
						<Icon name="zap-circle" size="16" color="primary" />
						<Text size="16" weight="600" color="primary" style="transform: translate3d(0, 0, 0, 0)">
							Transaction
						</Text>
					</Flex>

					<Flex @click="handleCopy(tx.hash)" align="center" gap="6" class="copyable">
						<Text size="12" weight="600" color="tertiary">
							{{ tx.hash.slice(0, 4) }}
							<Text color="dark">•••</Text>
							{{ tx.hash.slice(-4) }}
						</Text>
						<Icon name="copy" size="12" color="tertiary" />
					</Flex>
				</Flex>

				<Flex v-if="transfer" align="center" direction="column" gap="8">
					<Text size="24" weight="500" color="primary">
						{{ new BN(transfer.amount / 10 ** 8).toFixed() }}
						<Text color="tertiary">{{ transfer.token.symbol }}</Text>
					</Text>
					<Text size="12" weight="500" color="tertiary"> Transfer Amount </Text>
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
							<Text size="13" weight="600" color="primary">
								{{ transfer.from.slice(0, 6) }}
								<Text color="dark">•••</Text>
								{{ transfer.from.slice(-4) }}
							</Text>
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
							<Text size="13" weight="600" color="primary">
								{{ transfer.to.slice(0, 6) }}
								<Text color="dark">•••</Text>
								{{ transfer.to.slice(-4) }}
							</Text>
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
