<script setup>
/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"

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
	return popupStore.len - popupStore.popups.token_metadata?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const token = ref()
const tokenService = new TokenServiceClient()
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenDeleted(token) {
	if (token.id === cacheStore.activeTokenIdx) {
		openToast({ label: "Token has been deleted" })

		emit("onClose")
	}
}

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(token.value.contract)
	openToast({ label: "Contract address is copied", icon: "copy" })
}

watch(
	() => props.show,
	async () => {
		if (props.show) {
			if (route.params.id) {
				cacheStore.activeTokenIdx = route.params.id
				token.value = await tokenService.getToken(cacheStore.activeTokenIdx)
			}
		} else {
			tokenService.disconnect()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.token_metadata?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary"> Token Metadata </Text>

				<Flex direction="column" gap="16">
					<Flex align="center" justify="between">
						<Text size="12" weight="600" color="tertiary"> Id </Text>

						<Text size="12" weight="600" color="secondary">
							{{ token?.id }}
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
						<Text size="12" weight="600" color="tertiary"> Chain ID </Text>

						<Tooltip position="end">
							<Flex align="center" gap="4">
								<Text size="12" weight="600" color="secondary">
									{{ token.chainId }}
								</Text>
								<Icon name="info" size="12" color="secondary" />
							</Flex>

							<template #content>
								<Text color="secondary">Network:</Text>
								{{ appStore.networks.find(t => t.chainId === token.chainId).name }}
							</template>
						</Tooltip>
					</Flex>

					<Flex align="center" gap="6" style="margin-top: 10px">
						<Text size="12" weight="600" color="secondary">Private Methods</Text>
						<Icon name="key-square" size="12" color="tertiary" />
					</Flex>

					<Flex align="center" justify="between">
						<Flex direction="column" gap="6">
							<Text size="12" weight="600" color="tertiary"> Balances </Text>
							<Text size="11" weight="600" color="dark" mono> hasPrivateBalances </Text>
						</Flex>

						<Icon
							:name="token.hasPrivateBalances ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPrivateBalances ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Flex direction="column" gap="6">
							<Text size="12" weight="600" color="tertiary"> Transfers </Text>
							<Text size="11" weight="600" color="dark" mono> hasPrivateTransfers </Text>
						</Flex>

						<Icon
							:name="token.hasPrivateTransfers ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPrivateTransfers ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Flex direction="column" gap="6">
							<Text size="12" weight="600" color="tertiary"> Private to public </Text>
							<Text size="11" weight="600" color="dark" mono> hasPrivateToPublicTransfers </Text>
						</Flex>

						<Icon
							:name="token.hasPrivateToPublicTransfers ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPrivateToPublicTransfers ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" gap="6" style="margin-top: 10px">
						<Text size="12" weight="600" color="secondary">Public Methods</Text>
						<Icon name="face" size="12" color="tertiary" />
					</Flex>

					<Flex align="center" justify="between">
						<Flex direction="column" gap="6">
							<Text size="12" weight="600" color="tertiary"> Balances </Text>
							<Text size="11" weight="600" color="dark" mono> hasPublicBalances </Text>
						</Flex>

						<Icon
							:name="token.hasPublicBalances ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPublicBalances ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Flex direction="column" gap="6">
							<Text size="12" weight="600" color="tertiary"> Transfers </Text>
							<Text size="11" weight="600" color="dark" mono> hasPublicTransfers </Text>
						</Flex>

						<Icon
							:name="token.hasPublicTransfers ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPublicTransfers ? 'green' : 'red'"
						/>
					</Flex>

					<Flex align="center" justify="between">
						<Flex direction="column" gap="6">
							<Text size="12" weight="600" color="tertiary"> Public to private </Text>
							<Text size="11" weight="600" color="dark" mono> hasPublicToPrivateTransfers</Text>
						</Flex>

						<Icon
							:name="token.hasPublicToPrivateTransfers ? 'check-circle' : 'close-circle'"
							size="12"
							:color="token.hasPublicToPrivateTransfers ? 'green' : 'red'"
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
