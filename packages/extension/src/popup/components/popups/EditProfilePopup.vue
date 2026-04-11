<script setup>
/** Services */
import { ProfileServiceClient } from "@/wallet/services/profile/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.edit_profile?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

let profileService = null
const nameTerm = ref("")
const isStartedEditing = ref(false)

const handleFillFieldsWithDefaultValues = () => {
	nameTerm.value = appStore.profile?.name

	isStartedEditing.value = false
}

const isAlreadyExist = computed(() => appStore.profile.name.toLowerCase() === nameTerm.value.toLowerCase() && isStartedEditing.value)
const isAvailableToUpdateProfile = computed(() => {
	if (!nameTerm.value?.length) return
	if (isAlreadyExist.value) return

	return true
})

const isProfileUpdateInProgress = ref(false)
const handleUpdateProfile = async () => {
	if (!isAvailableToUpdateProfile.value) return

	isProfileUpdateInProgress.value = true
	try {
		appStore.profile = await profileService.changeProfileName(appStore.profile.id, nameTerm.value)
		emit("onClose")

		openToast({ label: "Profile is updated" })
	} catch (err) {
	} finally {
		isProfileUpdateInProgress.value = false
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			profileService.disconnect()
			profileService = null
			nameTerm.value = ""
			isStartedEditing.value = false
		} else {
			profileService = new ProfileServiceClient()
			nameTerm.value = appStore.profile?.name

			document.addEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = (e) => {
	if (e.key === "Enter") handleUpdateProfile()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_profile?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit profile</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						size="large"
						:title="appStore.profile?.name"
						description="Profile for editing"
						icon="user"
						raw
					/>
				</ItemsContainer>

				<Input
					label="New name"
					placeholder="My Profile"
					v-model="nameTerm"
					autofocus
					sanitize
					:maxLength="25"
					@input="isStartedEditing = true"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="12">
					<Button
						@click="handleUpdateProfile"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToUpdateProfile || !isStartedEditing"
						:loading="isProfileUpdateInProgress"
					>
						Update
					</Button>
					<Button @click="handleFillFieldsWithDefaultValues" wide type="secondary" size="medium">
						Reset changes
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.3;
	}
}
</style>
