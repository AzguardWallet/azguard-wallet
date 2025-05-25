<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Services */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.import?.order
})

const router = useRouter()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const type = computed(() => cacheStore.importType)

const selectedImportOption = ref()

const seedPhrase = ref()
const privateKey = ref()
const publicKey = ref()

const profileName = ref("My Profile")

const password = ref('')
const repeatedPassword = ref('')
const isPasswordType = ref(true)
const hideCredentials = ref(true)
const maxPasswordLength = 128
const isWrongPassword = ref(false)

const handlePasswordInput = () => {
	if (isWrongPassword.value) isWrongPassword.value = false
}

const isAllowedToContinue = computed(() => {
	if (!profileName.value || profileName.value.length < 2) {
		return false
	}

	if (!password.value || password.value.length < 8) {
		return false
	}

	if (
		selectedImportOption.value !== "public_key" &&
		(!repeatedPassword.value || password.value !== repeatedPassword.value)
	) {
		return false
	}

	return true
})
const isAllowedToImportBySeedPhrase = computed(() => {
	if (!isAllowedToContinue.value) return
	return seedPhrase.value?.split(" ").length === 24 && password.value?.length >= 8
})
const isAllowedToImportByPrivateKey = computed(() => {
	if (!isAllowedToContinue.value) return
	return !!privateKey.value
})
const isAllowedToImportByPublicKey = computed(() => {
	if (!isAllowedToContinue.value) return
	return !!publicKey.value
})

const handleImportSeed = async () => {
	if (!isAllowedToImportBySeedPhrase.value) return

	try {
		const profile = await managers.profile.importMnemonic(
			profileName.value.trim(),
			seedPhrase.value.split(" "),
			password.value,
		)
		appStore.profiles.push(profile)

		router.push("/popup/general")
	} catch (error) {
		console.error(error)
	} finally {
		popupStore.closeAll()
	}
}

const handleImportPrivateKey = async () => {
	if (!isAllowedToImportByPrivateKey.value) return

	try {
		const profile = await managers.profile.importPlain(profileName.value.trim(), privateKey.value, password.value)
		appStore.profiles.push(profile)
		popupStore.closeAll()

		router.push("/popup/general")
	} catch (error) {
		console.error(error)
	}
}

const handleImportPublicKey = async () => {
	if (!isAllowedToImportByPublicKey.value) return

	try {
		const profile = await managers.profile.importEncrypted(
			profileName.value.trim(),
			publicKey.value,
			password.value,
		)
		appStore.profiles.push(profile)
		popupStore.closeAll()

		router.push("/popup/general")
	} catch (error) {
		if (error === "Invalid password") {
			isWrongPassword.value = true
		}
	}
}

const handleBack = () => {
	selectedImportOption.value = null

	profileName.value = "My Profile"
	privateKey.value = null
	publicKey.value = null
	seedPhrase.value = null
	password.value = null
	repeatedPassword.value = null
	isPasswordType.value = true
	hideCredentials.value = true
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			selectedImportOption.value = null

			profileName.value = "My Profile"
			privateKey.value = null
			publicKey.value = null
			seedPhrase.value = null
			password.value = null
			repeatedPassword.value = null
			isPasswordType.value = true
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.import?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon :name="type === 'recovery' ? 'restart' : 'plus-circle'" size="18" color="blue" />
						<Text size="16" weight="600" color="primary">
							{{ type === "recovery" ? "Recovery Profile" : "Import Profile" }}
						</Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" style="padding: 0 12px">
						Choose from the following options to {{ type === "recovery" ? "recovery" : "import" }} your
						profile
					</Text>
				</Flex>

				<ItemsContainer
					v-if="!selectedImportOption"
					:title="`${type === 'recovery' ? 'Recovery' : 'Import'} with`"
					description=""
				>
					<SettingItem
						@click="selectedImportOption = 'seed'"
						title="Seed Phrase"
						icon="text"
						iconBgColor="blue"
						chevron
					/>
					<SettingItem
						@click="selectedImportOption = 'private_key'"
						title="Plain Key"
						icon="key"
						iconBgColor="blue"
						chevron
					/>
					<SettingItem
						@click="selectedImportOption = 'public_key'"
						title="Encrypted Key"
						icon="key"
						iconBgColor="blue"
						chevron
					/>
				</ItemsContainer>

				<template v-else>
					<Flex direction="column" gap="24">
						<Input
							v-if="selectedImportOption === 'private_key'"
							v-model="privateKey"
							:type="hideCredentials ? 'password' : 'text'"
							label="Plain Key"
							placeholder="Enter plain key"
						>
							<template #suffix>
								<Icon
									@click.stop="hideCredentials = !hideCredentials"
									:name="hideCredentials ? 'password' : 'text'"
									size="16"
									color="secondary"
									class="clickable"
								/>
							</template>
						</Input>
						<Input
							v-if="selectedImportOption === 'public_key'"
							v-model="publicKey"
							:type="hideCredentials ? 'password' : 'text'"
							label="Encrypted Key"
							placeholder="Enter encrypted key"
						>
						<template #suffix>
								<Icon
									@click.stop="hideCredentials = !hideCredentials"
									:name="hideCredentials ? 'password' : 'text'"
									size="16"
									color="secondary"
									class="clickable"
								/>
							</template>
						</Input>

						<Input
							v-if="selectedImportOption === 'seed'"
							v-model="seedPhrase"
							:type="hideCredentials ? 'password' : 'text'"
							label="Seed Phrase"
							placeholder="Enter seed phrase "
						>
							<template #labelSuffix>
								<Tooltip position="start">
									<Icon name="info" size="12" color="tertiary" hoverColor="primary" />

									<template #content> Words should be separated by spaces </template>
								</Tooltip>
							</template>

							<template #suffix>
								<Icon
									@click.stop="hideCredentials = !hideCredentials"
									:name="hideCredentials ? 'password' : 'text'"
									size="16"
									color="secondary"
									class="clickable"
								/>
							</template>

							<template v-if="seedPhrase?.split(' ').length === 24" #right>
								<Flex align="center" gap="4">
									<Icon name="check-circle" size="12" color="green" />
									<Text size="12" weight="600" color="primary">Correct</Text>
								</Flex>
							</template>
						</Input>

						<!-- <Input
							v-model="profileName"
							:maxLength="64"
							type="text"
							label="Profile Name"
							placeholder="Profile name"
						/> -->

						<Flex v-if="['private_key', 'seed'].includes(selectedImportOption)" direction="column" gap="8">
							<Input
								v-model="password"
								:type="isPasswordType ? 'password' : 'text'"
								@input="handlePasswordInput"
								:maxLength="maxPasswordLength"
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

								<template #right>
									<Flex align="center" gap="6">
										<Icon name="password" size="12" color="tertiary" />
										<Text size="12" weight="600" color="tertiary">
											{{
												((!password || password?.length < 8) && "At least 8 characters") ||
												(password !== repeatedPassword && "Not repeated") ||
												(password?.length > 24 && "I hope you remember it") ||
												"Looks.. strong?"
											}}
										</Text>
									</Flex>
								</template>
							</Input>

							<Input
								v-model="repeatedPassword"
								:type="isPasswordType ? 'password' : 'text'"
								@input="handlePasswordInput"
								:maxLength="maxPasswordLength"
								placeholder="Repeat password"
							/>

							<Text size="12" weight="500" color="tertiary" height="150">
								Create a new password that will be used to log in to your profile in the future
							</Text>
						</Flex>

						<Input
							v-else
							v-model="password"
							:type="isPasswordType ? 'password' : 'text'"
							@input="handlePasswordInput"
							:maxLength="maxPasswordLength"
							type="password"
							label="Password"
							placeholder="Enter profile password"
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
								<Transition name="fade">
									<Flex v-if="isWrongPassword" align="center" gap="4">
										<Icon name="warning" size="12" color="red" />
										<Text size="12" weight="600" color="primary">Wrong password</Text>
									</Flex>
								</Transition>
							</template>
						</Input>
					</Flex>

					<Flex direction="column" gap="8">
						<Button
							v-if="selectedImportOption === 'seed'"
							@click="handleImportSeed"
							:disabled="!isAllowedToImportBySeedPhrase"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Use Seed Phrase
						</Button>
						<Button
							v-if="selectedImportOption === 'private_key'"
							@click="handleImportPrivateKey"
							:disabled="!isAllowedToImportByPrivateKey"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Use Plain Key
						</Button>
						<Button
							v-if="selectedImportOption === 'public_key'"
							@click="handleImportPublicKey"
							:disabled="!isAllowedToImportByPublicKey"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Use Encrypted Key
						</Button>

						<Button v-if="selectedImportOption" @click="handleBack" type="secondary" size="medium" wide>
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
