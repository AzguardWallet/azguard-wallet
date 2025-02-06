<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"

/** Services */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.import
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const selectedRecoveryOption = ref()

const privateKey = ref()
const seedPhrase = ref()

const profileName = ref("My Profile")

const password = ref()
const repeatedPassword = ref()
const isPasswordType = ref(true)

const handleProfileNameInput = () => {
	if (profileName.value.length > 64) {
		profileName.value = profileName.value.slice(0, 64)
	}
}
const handlePasswordInput = () => {
	if (password.value.length > 64) {
		password.value = password.value.slice(0, 64)
	}
}
const handleRepeatedPasswordInput = () => {
	if (repeatedPassword.value.length > 64) {
		repeatedPassword.value = repeatedPassword.value.slice(0, 64)
	}
}

const isAllowedToContinue = computed(() => {
	if (!profileName.value || profileName.value.length < 2) {
		return false
	}

	if (!password.value || password.value.length < 8) {
		return false
	}

	if (!repeatedPassword.value || password.value !== repeatedPassword.value) {
		return false
	}

	return true
})
const isAllowedToRecoverBySeedPhrase = computed(() => {
	if (!isAllowedToContinue.value) return
	return seedPhrase.value?.split(" ").length === 24 && password.value?.length >= 8
})
const isAllowedToRecoverByPrivateKey = computed(() => {
	if (!isAllowedToContinue.value) return
	return !!privateKey.value
})

const handleImportSeed = async () => {
	if (!isAllowedToRecoverBySeedPhrase.value) return

	try {
		const profile = await managers.profile.importMnemonic(
			profileName.value.trim(),
			seedPhrase.value.split(" "),
			password.value,
		)
		appStore.profiles.push(profile)
	} catch (error) {
		console.error(error)
	} finally {
		popupStore.closeAll()
	}
}

const handleImportPrivateKey = async () => {
	if (!isAllowedToRecoverByPrivateKey.value) return

	try {
		const profile = await managers.profile.importPlain(profileName.value.trim(), privateKey.value, password.value)
		appStore.profiles.push(profile)
	} catch (error) {
		console.error(error)
	} finally {
		popupStore.closeAll()
	}
}

const handleBack = () => {
	selectedRecoveryOption.value = null

	profileName.value = "My Profile"
	privateKey.value = null
	seedPhrase.value = null
	password.value = null
	repeatedPassword.value = null
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			selectedRecoveryOption.value = null

			profileName.value = "My Profile"
			privateKey.value = null
			seedPhrase.value = null
			password.value = null
			repeatedPassword.value = null
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.import">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="restart" size="18" color="blue" />
						<Text size="16" weight="600" color="primary"> Profile Recovery </Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" style="padding: 0 12px">
						Choose from the following options to recovery your profile
					</Text>
				</Flex>

				<ItemsContainer v-if="!selectedRecoveryOption" title="Recovery with" description="">
					<SettingItem
						@click="selectedRecoveryOption = 'seed'"
						title="Seed Phrase"
						icon="text"
						iconBgColor="blue"
						chevron
					/>
					<SettingItem
						@click="selectedRecoveryOption = 'private_key'"
						title="Plain Key"
						icon="key"
						iconBgColor="blue"
						chevron
					/>
				</ItemsContainer>

				<template v-else>
					<Flex direction="column" gap="24">
						<Input
							v-if="selectedRecoveryOption === 'private_key'"
							v-model="privateKey"
							type="password"
							label="Plain Key"
							placeholder="Enter plain key"
						>
						</Input>

						<Input
							v-if="selectedRecoveryOption === 'seed'"
							v-model="seedPhrase"
							type="password"
							label="Seed Phrase"
							placeholder="Enter seed phrase "
						>
							<template #labelSuffix>
								<Tooltip position="start">
									<Icon name="info" size="12" color="tertiary" hoverColor="primary" />

									<template #content> Words should be separated by spaces </template>
								</Tooltip>
							</template>

							<template v-if="seedPhrase?.split(' ').length === 24" #right>
								<Flex align="center" gap="4">
									<Icon name="check-circle" size="12" color="green" />
									<Text size="12" weight="600" color="primary">Correct</Text>
								</Flex>
							</template>
						</Input>

						<Input
							v-model="profileName"
							@input="handleProfileNameInput"
							type="text"
							label="Profile Name"
							placeholder="Profile name"
						/>

						<Flex direction="column" gap="8">
							<Input
								v-model="password"
								:type="isPasswordType ? 'password' : 'text'"
								@input="handlePasswordInput"
								type="password"
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
							</Input>

							<Input
								v-model="repeatedPassword"
								:type="isPasswordType ? 'password' : 'text'"
								@input="handleRepeatedPasswordInput"
								placeholder="Repeat password"
							/>

							<Text size="12" weight="500" color="tertiary" height="150">
								Create a new password that will be used to log in to your profile in the future
							</Text>
						</Flex>
					</Flex>

					<Flex direction="column" gap="8">
						<Button
							v-if="selectedRecoveryOption === 'seed'"
							@click="handleImportSeed"
							:disabled="!isAllowedToRecoverBySeedPhrase"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Use seed phrase to recover
						</Button>
						<Button
							v-if="selectedRecoveryOption === 'private_key'"
							@click="handleImportPrivateKey"
							:disabled="!isAllowedToRecoverByPrivateKey"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Use plain key to recover
						</Button>

						<Button v-if="selectedRecoveryOption" @click="handleBack" type="secondary" size="medium" wide>
							Back
						</Button>
					</Flex>
				</template>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
