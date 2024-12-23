<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"

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

const route = useRoute()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.token_metadata
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const token = computed(() => {
	// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
	return appStore.tokens.findLast(t => t.id == cacheStore.activeTokenIdx)
})

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(token.value.contract)
	openToast({ label: "Contract address is copied", icon: "copy" })
}

watch(
	() => props.show,
	() => {
		if (props.show) {
			if (route.params.id) {
				cacheStore.activeTokenIdx = route.params.id
			}
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.token_metadata">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary"> Token Metadata </Text>

				<Flex direction="column" gap="16">
					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Id </Text>

						<Text size="12" weight="600" color="secondary">
							{{ token.id }}
						</Text>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Contract Address </Text>

						<Text @click="handleCopyAddress" size="12" weight="600" color="secondary" class="copyable">
							{{ token.contract.slice(0, 6) }}
							<Text color="dark">•••</Text>
							{{ token.contract.slice(-4) }}
						</Text>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Name </Text>

						<Text size="12" weight="600" color="secondary">
							{{ token.name }}
						</Text>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Symbol </Text>

						<Text size="12" weight="600" color="secondary">
							{{ token.symbol }}
						</Text>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Private Balances </Text>

						<Icon
							:name="token.hasPrivateBalances ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPrivateBalances ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Public Balances </Text>

						<Icon
							:name="token.hasPublicBalances ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPublicBalances ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Public Transfers </Text>

						<Icon
							:name="token.hasPublicTransfers ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPublicTransfers ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Private Transfers </Text>

						<Icon
							:name="token.hasPrivateTransfers ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPrivateTransfers ? 'green' : 'red'"
						/>
					</Flex>
				</Flex>

				<Button @click="emit('onClose')" wide type="secondary" size="medium"> Close </Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
