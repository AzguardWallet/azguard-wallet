<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onSelectToken", "onClose"])
const props = defineProps({
	show: Boolean,
	displaceIdx: Number,
})

const router = useRouter()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_token
})

const handleSelectToken = id => {
	cacheStore.activeTokenIdx = id
	emit("onClose")
}

const handleManageTokens = () => {
	router.push("/popup/settings/general/tokens")
	popupStore.closeAll()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.select_token">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Select token</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						v-for="token in appStore.tokens"
						@click="handleSelectToken(token.id)"
						:title="token.symbol"
						:icon="token.id === cacheStore.activeTokenIdx ? 'check-circle' : 'circle'"
						:iconFillColor="token.id === cacheStore.activeTokenIdx ? 'blue' : 'tertiary'"
						iconBgColor="transparent"
					/>
				</ItemsContainer>

				<ItemsContainer>
					<SettingItem
						@click="handleManageTokens"
						size="small"
						title="Manage tokens"
						icon="settings"
						iconFillColor="secondary"
						iconBgColor="transparent"
						chevron
					/>
				</ItemsContainer>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.token {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px 16px 12px 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
