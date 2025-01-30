<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onSelectToken", "onClose"])
const props = defineProps({
	show: Boolean,
	displaceIdx: Number,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_profile
})

const handleSelectProfile = profile => {
	appStore.profile = profile
	emit("onClose")
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.select_profile">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="16" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary"> Select profile </Text>

					<ItemsContainer>
						<SettingItem
							v-for="profile in appStore.profiles"
							@click="handleSelectProfile(profile)"
							:title="profile.name"
							:description="profile.id"
							icon="user"
							iconBgColor="blue"
						/>
					</ItemsContainer>
				</Flex>
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
