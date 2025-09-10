<script setup>
/** Utils */
import { ProfileServiceClient } from "@/wallet/services/profile/client"

/** Components */
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import RegisterPopup from "../popups/RegisterPopup/RegisterPopup.vue"
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

const profileService = new ProfileServiceClient()
profileService.onProfileAdded.add(onProfileAddedOrUpdated)
profileService.onProfileUpdated.add(onProfileAddedOrUpdated)
profileService.onProfileDeleted.add(onProfileDeleted)

const profiles = ref([])
const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_profile?.order
})

const handleSelectProfile = profile => {
	appStore.profile = profile
	emit("onClose")
}

const handleProfileCreated = async () => {
	appStore.profiles = await managers.profile.getProfiles()
	emit("onClose")
}

function onProfileAddedOrUpdated(profile) {
	const idx = profiles.value.findIndex(p => p.id === profile.id)
	if (idx === -1) {
		profiles.value.push(profile)
	} else {
		profiles.value[idx] = profile
	}
}

function onProfileDeleted(profile) {
	const idx = profiles.value.findIndex(p => p.id === profile.id)
	if (idx !== -1) {
		profiles.value.splice(idx, 1)
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			profileService?.disconnect()

			profiles.value = []
		} else {
			profiles.value = await profileService.getProfiles()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.select_profile?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="16" :class="$style.wrapper">
				<Flex direction="column" gap="16">
					<Text size="14" weight="600" color="primary"> Select profile </Text>

					<ItemsContainer>
						<SettingItem
							v-for="profile in profiles"
							@click="handleSelectProfile(profile)"
							:title="profile.name"
						>
							<template #right>
								<Icon
									:name="
										profile?.id === appStore.profile?.id
											? 'check-circle'
											: 'circle'
									"
									size="16"
									:color="
										profile?.id === appStore.profile?.id
											? 'green'
											: 'tertiary'
									"
								/>
							</template>
						</SettingItem>
					</ItemsContainer>

					<Flex wide direction="column" gap="6">
						<Button
							@click="appStore.showRegisterPopup = true"
							wide
							type="primary"
							size="medium"
							leftIcon="plus-circle"
							leftIconColor="primary"
						>
							<Text size="13">New Profile</Text>
						</Button>
						<Button @click="popupStore.open('import')" size="medium" type="secondary" wide> Import Profile </Button>
					</Flex>
				</Flex>
			</Flex>

			<Transition name="slide">
				<RegisterPopup
					v-if="appStore.showRegisterPopup"
					@onProfileCreated="handleProfileCreated"
				/>
			</Transition>
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