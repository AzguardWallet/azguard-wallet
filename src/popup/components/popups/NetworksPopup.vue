<script setup>
/** Components */
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Services */
import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.networks
})

const router = useRouter()

const handleSelectNetwork = target => {
	if (appStore.network.id === target.id) return
	managers.network.setDefault(appStore.network.id)
	appStore.network = target
	chrome.storage.local.set({ "azguard:ui:activeNetwork": appStore.network.id })

	emit("onClose")
}

const handleManageNetworks = () => {
	router.push("/popup/settings/general/networks")
	emit("onClose")
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.networks">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Switch node</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="16" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						v-for="network in appStore.networks"
						@click="handleSelectNetwork(network)"
						:title="network.name"
						:icon="appStore.network.id === network.id ? 'check' : 'n'"
						iconFillColor="blue"
						iconBgColor="transparent"
					>
						<template #right>
							<NetworkBadge :chainId="network.chainId" />

							<Tooltip side="left">
								<Icon name="info" size="14" color="tertiary" />

								<template #content>
									<Flex direction="column" gap="6" align="center">
										<Text> <Text color="secondary">ID:</Text> {{ network.chainId }} </Text>
										<Text> <Text color="secondary">URL:</Text> {{ network.rpcUrl }} </Text>
									</Flex>
								</template>
							</Tooltip>
						</template>
					</SettingItem>
				</ItemsContainer>

				<Divider>
					<Text size="12" weight="500" color="tertiary"> or </Text>
				</Divider>

				<ItemsContainer>
					<SettingItem @click="handleManageNetworks" title="Manage nodes" chevron />
				</ItemsContainer>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;

	padding: 0 20px 24px 20px;
}
</style>
