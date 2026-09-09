<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Services */
import { managers, setSentinel } from "@/utils/core"
import { BackupServiceClient, BACKUP_ERRORS } from "@/wallet/services/backup/client"
import { getErrorMessage } from "@/wallet/utils/errors"

/** Utils */
import { pickFile } from "@/utils"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { useCacheStore } from "@/stores/cache.store"
import { useNotificationStore } from "@/stores/notification.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()
const notificationStore = useNotificationStore()

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
const importedProfile = ref()

const password = ref('')
const repeatedPassword = ref('')
const decryptionPassword = ref('')
const isPasswordType = ref(true)
const hideCredentials = ref(true)
const maxPasswordLength = 128
const isSeedPhraseCorrect = ref(undefined)
const error = ref({ type: "", title: "", tooltip: ""})

const backupService = new BackupServiceClient()
const fillError = (type, title, tooltip) => {
	if (!title) {
		error.value = { type: "", title: "", tooltip: "" }
		return
	}

	error.value = { type, title, tooltip }
}
const isCopied = ref(false)
function handleCopyError(error) {
	isCopied.value = true

	window.navigator.clipboard.writeText(`${error.title}${error.tooltip ? `: ${error.tooltip}` : ""}`)

	openToast({ label: "Error is copied", icon: "copy" }, 2_000)

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
}

const handlePasswordInput = () => {
	isSeedPhraseCorrect.value = undefined
	if (error.value.type === "password") {
		fillError()
	}
}
const handleSecretInput = () => {
	isSeedPhraseCorrect.value = undefined

	if (error.value.type === "secret") {
		fillError()
	}
}
const handleSeedPhraseInputBlur = () => {
	if (!seedPhrase.value) {
		isSeedPhraseCorrect.value = undefined
		return
	}
	
	isSeedPhraseCorrect.value = seedPhrase.value?.split(" ").length === 24
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

const completeImport = async (profile) => {
		appStore.profiles.push(profile)
		appStore.profile = profile

		await setSentinel()

		popupStore.closeAll()

		router.push("/popup/general")
}

const handleImportSeed = async () => {
	if (!isAllowedToImportBySeedPhrase.value) return

	try {
		const profile = await managers.profile.importMnemonic(
			profileName.value.trim(),
			seedPhrase.value.split(" "),
			password.value,
		)

		await completeImport(profile)
	} catch (error) {
		fillError("unknown", error);
	}
}

const handleImportPrivateKey = async () => {
	if (!isAllowedToImportByPrivateKey.value) return

	try {
		const profile = await managers.profile.importPlain(profileName.value.trim(), privateKey.value, password.value)

		await completeImport(profile)
	} catch (error) {
		if (error === "Invalid secret length") {
			fillError("secret", error.replace("secret", "key"));
		} else {
			fillError("unknown", error);
		}
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

		await completeImport(profile)
	} catch (error) {
		if (error === "Invalid password") {
			fillError("unknown", "Invalid key or password")
		} else {
			fillError("unknown", error)
		}
	}
}

const handleImportPasskey = async () => {
	try {
		const profile = await managers.profile.importPasskey(profileName.value.trim())
		
		await completeImport(profile)
	} catch (error) {
		if (!error?.toLowerCase().includes("user closed") && !error?.toLowerCase().includes("operation either timed out or was not allowed")) {
			notificationStore.create({
				type: "warning",
				payload: {
					title: "Profile Import Failed",
					description: "An error occurred while importing the profile. This authenticator may not be supported or encountered an issue. Try again or use another one.",
					note: "Windows Hello may not work correctly with some versions of Windows.",
					confirmText: "OK",
					onConfirm: () => {},
				},
			})
		}

		console.error("Failed to import profile:", error);
	}
}

// NOTE: backup files reach 100MB+ — the text goes straight to the service and never
// enters reactive state; this holds only the inspection summary
const selectedBackup = ref(null)
let importOp = -1
const isAllowedToImportBackup = computed(() => {
	if (!selectedBackup.value?.profileType) return
	if (selectedBackup.value?.profileType === "password") {
		if (!password.value ||
			password.value !== repeatedPassword.value ||
			password.value?.length < 8
		) return
	}

	return true
})
async function handlePickBackupFile() {
	if (restoreStatus.value === 'progress') return

	try {
		const file = await pickFile()
		if (!file) return
		const text = await file.text()

		let inspection
		try {
			importOp = await backupService.sendImport(text)
			inspection = await backupService.inspectImport(importOp)
		} catch (err) {
			selectedBackup.value = { name: file.name, stage: "unrecognized", profileType: null, profileName: null }
			fillError(
				"full_backup",
				"Invalid JSON Format",
				"The selected file is not a valid JSON backup. Please select a correct backup file.",
			)
			return
		}

		selectedBackup.value = { name: file.name, ...inspection }
		if (inspection.stage === "unrecognized") {
			fillError(
				"full_backup",
				"Unrecognized Backup File",
				"The selected file is not a valid backup. Please select a correct backup file.",
			)
			return
		}

		restoreStatus.value = null
		password.value = null
		repeatedPassword.value = null
		decryptionPassword.value = null

		fillError()
	} catch (err) {
		fillError(
			"full_backup",
			"Failed to read the backup file",
		)
		console.error("Failed to read backup file:", getErrorMessage(err))
	}
}
async function handleDecryptBackup() {
	if (!decryptionPassword.value) return

	try {
		const inspection = await backupService.decryptImport(importOp, decryptionPassword.value)

		selectedBackup.value = { name: selectedBackup.value.name, ...inspection }
		if (inspection.stage === "unrecognized") {
			fillError(
				"full_backup",
				"Unrecognized Backup File",
				"The decrypted content is not a valid backup.",
			)
			return
		}

		fillError()
	} catch (error) {
		fillError(
			"full_backup",
			"Decryption Failed",
			"The provided password is incorrect or the backup file is corrupted. Please try again with the correct password or select another file.",
		)
	}	
}
const restoreStatus = ref()
const restoreErrorLog = ref({})
const isRestoreHasErrors = computed(() => Object.keys(restoreErrorLog.value).length > 0)
function handleShowRestoreErrorLog() {
	if (!isRestoreHasErrors.value) return

	cacheStore.viewerData = restoreErrorLog.value
	popupStore.open("data_viewer")
}
async function handleRestoreBackup() {
	if (!isAllowedToImportBackup.value) return

	fillError()
	restoreStatus.value = "progress"

	try {
		restoreErrorLog.value = {}

		const report = await backupService.finishImport(importOp, password.value || undefined)

		restoreErrorLog.value = report.failures
		const newProfile = report.profile

		restoreStatus.value = "finished"
		if (!isRestoreHasErrors.value) {
			completeImport(newProfile)

			return
		}

		importedProfile.value = newProfile
	} catch (err) {
		// NOTE: fail closed — the service has already dropped the job's file, so a retry
		// has nothing to run, the user must pick the file again
		restoreStatus.value = "failed"

		switch (err) {
			case BACKUP_ERRORS.integrity:
				fillError(
					"full_backup",
					"Backup Integrity Check Failed",
					"The backup file appears to be corrupted or has been tampered with. Please ensure you have the correct backup file.",
				)
				break
			case BACKUP_ERRORS.incompatible:
				fillError(
					"full_backup",
					"Incompatible Backup",
					"The profile in this backup belongs to a different Aztec network generation and can't be restored into this wallet version.",
				)
				break
			case BACKUP_ERRORS.outdated:
				fillError(
					"full_backup",
					"Outdated Backup",
					"This backup is from an older wallet generation and can't be restored into this wallet version.",
				)
				break
			case BACKUP_ERRORS.newer:
				fillError(
					"full_backup",
					"Backup From a Newer Wallet",
					"This backup was created by a newer wallet version and can't be imported here. Update the wallet and try again.",
				)
				break
			default:
				fillError("full_backup", "Import failed", err)
				console.error(getErrorMessage(err))
		}

		return
	}
}

function clearPopup() {
	if (importOp !== -1) {
		backupService.abortImport(importOp).catch(() => {})
		importOp = -1
	}

	selectedImportOption.value = null
	importedProfile.value = null

	profileName.value = ""
	privateKey.value = null
	publicKey.value = null
	seedPhrase.value = null
	password.value = null
	repeatedPassword.value = null
	decryptionPassword.value = null
	isPasswordType.value = true
	hideCredentials.value = true

	selectedBackup.value = null
	restoreStatus.value = ""
	restoreErrorLog.value = {}
	
	fillError()
}
const handleBack = () => {
	clearPopup()
}

const onKeydown = e => {
	if (e.key === "Enter") {
		if (selectedBackup.value?.stage === "needs-password") {
			handleDecryptBackup()
		} else if (selectedBackup.value?.profileType && restoreStatus.value !== "finished") {
			handleRestoreBackup()
		} else if (restoreStatus.value === "finished" && isRestoreHasErrors.value) {
			completeImport(importedProfile.value)
		}
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			clearPopup()
		} else {
			const profiles = await managers.profile.getProfiles()
			profileName.value = `My Profile${profiles?.length ? ` ${profiles?.length}` : ''}`

			document.addEventListener("keydown", onKeydown)
		}
	},
)

onBeforeUnmount(() => backupService.disconnect())
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
						@click="selectedImportOption = 'full_backup'"
						title="Full Backup"
						icon="package"
						iconBgColor="blue"
						chevron
					/>
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
					<SettingItem
						@click="handleImportPasskey"
						title="Passkey (WebAuthn)"
						icon="key"
						iconBgColor="blue"
						chevron
					/>
				</ItemsContainer>

				<template v-else>
					<Flex v-if="selectedImportOption === 'full_backup'" direction="column" gap="24">
						<ItemsContainer title="Backup">
							<SettingItem
								@click="handlePickBackupFile"
								title="Choose a backup file"
								:description="selectedBackup ? selectedBackup.name : 'Select a .json or .txt file'"
								icon="package"
								:iconBgColor="error.type === 'full_backup' ? 'red' : selectedBackup ? 'blue' : 'gray'"
								chevron
								:disabled="restoreStatus === 'progress'"
							/>
						</ItemsContainer>

						<Flex
							v-if="error.type === 'full_backup'"
							@click.stop="handleCopyError(error)"
							direction="column"
							gap="4"
							wide
							:class="$style.error_wrapper"
						>
							<Flex align="end" gap="8" :class="$style.error_title_wrapper">
								<Icon
									name="info"
									size="14"
									color="red"
								/>

								<Text size="12" weight="600" color="red" :class="$style.error_title">
									{{ error.title }}
								</Text>

								<Icon :name="isCopied ? 'check' : 'copy'" size="13" color="red" />
							</Flex>
							<Flex v-if="error.tooltip" align="start" :class="$style.error_description_wrapper" wide>
								<Text size="12" height="120" color="red" :class="$style.error_description">
									{{ error.tooltip }}
								</Text>
							</Flex>
						</Flex>

						<Flex v-if="restoreStatus === 'finished' && isRestoreHasErrors" direction="column" gap="4" style="margin-top: -16px; padding: 8px;;" wide>
							<Flex align="start">
								<Icon
									name="info"
									size="14"
									color="yellow"
								/>

								<Text size="12" weight="600" height="120" color="yellow" :style="{ paddingLeft: '4px' }">
									Profile import completed with some errors. You can review the details or continue.
								</Text>
							</Flex>
						</Flex>

						<Flex v-if="selectedBackup?.stage === 'needs-password'" direction="column" gap="12">
							<Input
								v-model="decryptionPassword"
								:type="isPasswordType ? 'password' : 'text'"
								:maxLength="maxPasswordLength"
								type="password"
								label="Decryption password"
								placeholder="Enter decryption password"
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
						</Flex>

						<Flex v-if="selectedBackup?.profileType === 'password' && !restoreStatus" direction="column" gap="8">
							<Input
								v-model="password"
								:type="isPasswordType ? 'password' : 'text'"
								@input="handlePasswordInput"
								:maxLength="maxPasswordLength"
								label="New password"
								placeholder="Enter new password"
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
					</Flex>

					<Flex v-else direction="column" gap="24">
						<Input
							v-if="selectedImportOption === 'private_key'"
							v-model="privateKey"
							@input="handleSecretInput"
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

							<template #right>
								<Transition v-if="error.type === 'secret'" name="fade">
									<Flex align="center" gap="4">
										<Icon name="warning" size="12" color="red" />
										<Text size="12" weight="600" color="primary">{{ error.title }}</Text>
									</Flex>
								</Transition>
							</template>
						</Input>
						<Input
							v-if="selectedImportOption === 'public_key'"
							v-model="publicKey"
							@input="handleSecretInput"
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

							<template #right>
								<Transition v-if="error.type === 'secret'" name="fade">
									<Flex align="center" gap="4">
										<Icon name="warning" size="12" color="red" />
										<Text size="12" weight="600" color="primary">{{ error.title }}</Text>
									</Flex>
								</Transition>
							</template>
						</Input>

						<Input
							v-if="selectedImportOption === 'seed'"
							v-model="seedPhrase"
							@input="handleSecretInput"
							@blur="handleSeedPhraseInputBlur"
							:type="hideCredentials ? 'password' : 'text'"
							label="Seed Phrase"
							placeholder="Enter seed phrase "
						>
							<template #labelSuffix>
								<Tooltip position="end" side="top">
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

							<template v-if="isSeedPhraseCorrect !== undefined" #right>
								<Flex v-if="isSeedPhraseCorrect" align="center" gap="4">
									<Icon name="check-circle" size="12" color="green" />
									<Text size="12" weight="600" color="primary">Correct</Text>
								</Flex>
								<Tooltip v-else position="end" side="top">
									<Icon name="close-circle" size="12" :class="!isSeedPhraseCorrect && $style.error_icon" />

									<template #content> The phrase should consist of 24 words </template>
								</Tooltip>
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
								<Flex v-if="!error.type && (!password || password?.length < 8)" align="center" gap="6">
									<Icon name="password" size="12" color="tertiary" />
									<Text size="12" weight="600" color="tertiary">
										At least 8 characters
									</Text>
								</Flex>
								<Transition v-else-if="error.type === 'password'" name="fade">
									<Flex align="center" gap="4">
										<Icon name="warning" size="12" color="red" />
										<Text size="12" weight="600" color="primary">Wrong password</Text>
									</Flex>
								</Transition>
							</template>
						</Input>
					</Flex>

					<Flex direction="column" gap="8">
						<Tooltip
							v-if="error.type === 'unknown'"
							side="top"
							position="start"
							wide
							:disabled="!error.tooltip"
						>
							<Flex align="center" wide>
								<Icon
									name="info"
									size="14"
									color="red"
								/>

								<Text size="12" weight="600" color="secondary" :style="{ paddingLeft: '4px' }">
									{{ error.title }}
								</Text>
							</Flex>

							<template #content>
								<Text size="12" color="secondary">
									{{ error.tooltip }}
								</Text>
							</template>
						</Tooltip>

						<Button
							v-if="selectedBackup?.stage === 'needs-password'"
							@click="handleDecryptBackup"
							:disabled="!decryptionPassword"
							type="primary"
							size="medium"
							rightIcon="lock-unlock"
							wide
						>
							Decrypt Backup
						</Button>
						<Button
							v-if="selectedBackup?.profileType && restoreStatus !== 'finished'"
							@click="handleRestoreBackup"
							:loading="restoreStatus === 'progress'"
							:disabled="!isAllowedToImportBackup || restoreStatus === 'failed'"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Import {{ selectedBackup?.profileName ?? "Profile" }}
						</Button>
						<Button
							v-if="restoreStatus === 'finished' && isRestoreHasErrors"
							@click="completeImport(importedProfile)"
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
							wide
						>
							Continue
						</Button>
						<Button
							v-if="restoreStatus === 'finished' && isRestoreHasErrors"
							@click="handleShowRestoreErrorLog"
							type="secondary"
							size="medium"
							rightIcon="brackets"
							wide
						>
							View Errors
						</Button>
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

						<Button
							v-if="selectedImportOption"
							@click="handleBack"
							type="secondary"
							size="medium"
							wide
							:disabled="restoreStatus === 'progress'"
						>
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

.error_icon {
	fill: var(--red) !important;
	opacity: 0.8;

	&:hover {
		fill: var(--red) !important;
		opacity: 1;
	}
}

.error_wrapper {
	margin-top: -16px;
	padding: 8px;
}

.error_title_wrapper {
	position: relative;

	.error_title {
		padding-right: 16px;

		display: -webkit-box;
		-webkit-box-orient: vertical;

		overflow: hidden;
		text-overflow: ellipsis;
		word-break: break-word;

		-webkit-line-clamp: 1;
	}

	& svg:last-child {
		position: absolute;
		top: 0;
		right: 0;

		opacity: 0.7;
	}
}

.error_description_wrapper {
	position: relative;

	.error_description {
		padding-right: 16px;

		display: -webkit-box;
		-webkit-box-orient: vertical;

		overflow: hidden;
		text-overflow: ellipsis;
		word-break: break-word;

		-webkit-line-clamp: 3;
	}
}
</style>
