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
	return popupStore.len - popupStore.popups.change_profile_password?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

let profileService = null
const currentPassword = ref("")
const newPassword = ref("")
const repeatedNewPassword = ref("")
const maxPasswordLength = 128
const isPasswordType = ref(true)

const error = ref(null)
const handlePasswordInput = () => {
	error.value = null
}
const isAvailableToChangePasswordProfile = computed(() => {
	if (!currentPassword.value?.length || !newPassword.value?.length || !repeatedNewPassword.value?.length) return
	if (newPassword.value !== repeatedNewPassword.value) return

	return true
})

const isLoading = ref(false)
const handleChangeProfilePassword = async () => {
	if (!isAvailableToChangePasswordProfile.value) return

	isLoading.value = true
	try {
		await profileService.changeProfilePassword(appStore.profile.id, currentPassword.value, newPassword.value)
		emit("onClose")

		openToast({ label: "Profile password changed" })
	} catch (err) {
		error.value = err
	} finally {
		isLoading.value = false
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			profileService.disconnect()
			profileService = null
			currentPassword.value = ""
			newPassword.value = ""
			repeatedNewPassword.value = ""

			isPasswordType.value = true

			error.value = null
		} else {
			profileService = new ProfileServiceClient()

			document.addEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = (e) => {
	if (e.key === "Enter") handleChangeProfilePassword()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.change_profile_password?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Change profile password</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						size="large"
						:title="appStore.profile?.name"
						icon="user"
						raw
					/>
				</ItemsContainer>

				<Flex direction="column" gap="16">
					<Input
						v-model="currentPassword"
						:type="isPasswordType ? 'password' : 'text'"
						@input="handlePasswordInput"
						label="Current password"
						placeholder="Enter current password"
						autofocus
					>
						<template #suffix>
							<Icon
								@click.stop="isPasswordType = !isPasswordType"
								:name="isPasswordType ? 'password' : 'text'"
								size="16"
								color="secondary"
								class="clickable"
							/>
						</template>
					</Input>

					<Flex direction="column" gap="6">
						<Input
							v-model="newPassword"
							:type="isPasswordType ? 'password' : 'text'"
							@input="handlePasswordInput"
							:maxLength="maxPasswordLength"
							label="New password"
							placeholder="Enter new password"
						>
							<template #suffix>
								<Icon
									@click.stop="isPasswordType = !isPasswordType"
									:name="isPasswordType ? 'password' : 'text'"
									size="16"
									color="secondary"
									class="clickable"
								/>
							</template>

							<template #right>
								<Flex align="center" gap="6">
									<Icon name="password" size="12" color="tertiary" />
									<Text size="12" weight="600" color="tertiary">
										{{
											((!newPassword || newPassword?.length < 8) && "At least 8 characters") ||
											(newPassword !== repeatedNewPassword && "Not repeated") ||
											(newPassword?.length > 24 && "I hope you remember it") ||
											"Looks.. strong?"
										}}
									</Text>
								</Flex>
							</template>
						</Input>

						<Input
							v-model="repeatedNewPassword"
							:type="isPasswordType ? 'password' : 'text'"
							@input="handlePasswordInput"
							:maxLength="maxPasswordLength"
							placeholder="Repeat new password"
						/>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12">
					<Flex v-if="error" align="start" gap="6">
						<Icon
							name="info"
							size="14"
							color="red"
						/>

						<Text size="12" weight="600" height="120" color="red">
							{{ error }}
						</Text>
					</Flex>
					
					<Button
						@click="handleChangeProfilePassword"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToChangePasswordProfile || error"
						:loading="isLoading"
					>
						Change Password
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
