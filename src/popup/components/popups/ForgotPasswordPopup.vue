<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.forgot_password
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.forgot_password">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="help" size="18" color="primary" />
						<Text size="16" weight="600" color="primary"> Forgot Password </Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" style="padding: 0 12px">
						Choose from the following options to restore or reset your profile
					</Text>
				</Flex>

				<ItemsContainer title="Possible Solutions">
					<SettingItem
						@click="popupStore.open('import')"
						title="Profile Recovery"
						icon="restart"
						iconBgColor="blue"
						chevron
					/>
					<SettingItem
						@click="popupStore.open('reset')"
						title="Reset Profile"
						icon="trash"
						iconBgColor="red"
						chevron
					/>
					<SettingItem
						@click="popupStore.open('select_profile')"
						title="Switch to other profile"
						icon="user"
						chevron
						:disabled="appStore.profiles.length === 1"
					/>
				</ItemsContainer>

				<ItemsContainer
					description="Requests to reset or recover your password will be ignored, use the recovery methods listed above"
				>
					<SettingItem
						@click="popupStore.open('import')"
						title="Report issue with authorization"
						to="https://google.com"
						icon="help"
						external
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
</style>
