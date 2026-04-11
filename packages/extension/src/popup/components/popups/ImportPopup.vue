<script setup>
/** Services */
import { managers, setSentinel } from "@/utils/core"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { AccountStateServiceClient } from "@/wallet/services/account-state/client"
import { AuthRegistryServiceClient } from "@/wallet/services/auth-registry/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { ContactServiceClient } from "@/wallet/services/contact/client"
import { FpcServiceClient } from "@/wallet/services/fpc/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { EncryptionKey } from "@/wallet/services/profile/encryption/encryption-key"

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

const password = ref("")
const repeatedPassword = ref("")
const decryptionPassword = ref("")
const isPasswordType = ref(true)
const hideCredentials = ref(true)
const maxPasswordLength = 128

const error = ref({ type: "", title: "", tooltip: "" })
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

	openToast({ label: "Error is copied", icon: "copy" })

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
}

const handlePasswordInput = () => {
	if (error.value.type === "password") {
		fillError()
	}
}

const handleSecretInput = () => {
	if (error.value.type === "secret") {
		fillError()
	}
}

const isAllowedToContinue = computed(() => {
	if (!profileName.value || profileName.value.length < 2) {
		return false
	}

	if (!password.value || password.value.length < 8) {
		return false
	}

	if (selectedImportOption.value !== "public_key" && (!repeatedPassword.value || password.value !== repeatedPassword.value)) {
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
		const profile = await managers.profile.importMnemonic(profileName.value.trim(), seedPhrase.value.split(" "), password.value)

		await completeImport(profile)
	} catch (error) {
		fillError("unknown", error)
	}
}

const handleImportPrivateKey = async () => {
	if (!isAllowedToImportByPrivateKey.value) return

	try {
		const profile = await managers.profile.importPlain(profileName.value.trim(), privateKey.value, password.value)

		await completeImport(profile)
	} catch (error) {
		if (error === "Invalid secret length") {
			fillError("secret", error.replace("secret", "key"))
		} else {
			fillError("unknown", error)
		}
	}
}

const handleImportPublicKey = async () => {
	if (!isAllowedToImportByPublicKey.value) return

	try {
		const profile = await managers.profile.importEncrypted(profileName.value.trim(), publicKey.value, password.value)

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
		if (
			!error?.toLowerCase().includes("user closed") &&
			!error?.toLowerCase().includes("operation either timed out or was not allowed")
		) {
			notificationStore.create({
				type: "warning",
				payload: {
					title: "Profile Import Failed",
					description:
						"An error occurred while importing the profile. This authenticator may not be supported or encountered an issue. Try again or use another one.",
					note: "Windows Hello may not work correctly with some versions of Windows.",
					confirmText: "OK",
					onConfirm: () => {},
				},
			})
		}

		console.error("Failed to import profile:", error)
	}
}

const selectedBackup = ref(null)
const isAllowedToImportBackup = computed(() => {
	if (!selectedBackup.value?.profileType || !selectedBackup.value?.backup) return
	if (selectedBackup.value?.profileType === "password") {
		if (!password.value || password.value !== repeatedPassword.value || password.value?.length < 8) return
	}

	return true
})
async function handlePickBackupFile() {
	if (restoreStatus.value === "progress") return

	try {
		const file = await pickFile()
		if (!file) return

		selectedBackup.value = await processBackupFile(file)
		if (selectedBackup.value?.type === "unknown" || (selectedBackup.value?.type === "plain" && !selectedBackup.value?.profileType)) {
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
		fillError("full_backup", "Failed to read the backup file")
		console.error("Failed to read backup file:", err.message || err)
	}
}
async function processBackupFile(file) {
	let backup = null
	let profileType = null

	const text = await file.text()
	const type = detectBackupType(text)
	if (type === "plain") {
		try {
			backup = JSON.parse(text)
			profileType = backup?.data?.profile?.type || null
		} catch (err) {
			fillError(
				"full_backup",
				"Invalid JSON Format",
				"The selected file is not a valid JSON backup. Please select a correct backup file.",
			)
		}
	} else {
		backup = text
	}

	return {
		name: file.name,
		backup,
		type,
		profileType,
	}
}
function detectBackupType(text) {
	const trimmed = text.trim()

	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return "plain"
	}

	try {
		const bytes = Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0))
		if (bytes.length >= 13 && bytes[0] === 0) {
			return "encrypted"
		}
	} catch (err) {
		return "unknown"
	}

	return "unknown"
}
async function handleDecryptBackup() {
	if (!decryptionPassword.value) return

	try {
		const passhash = await EncryptionKey.getPasshash(decryptionPassword.value)
		const key = await EncryptionKey.fromPasshash(passhash)
		const encryptedBytes = new Uint8Array(Buffer.from(selectedBackup.value?.backup, "base64"))
		const decryptedBytes = await key.decrypt(encryptedBytes)
		const decodedJson = new TextDecoder().decode(decryptedBytes)
		const backupObject = JSON.parse(decodedJson)

		selectedBackup.value = {
			...selectedBackup.value,
			backup: backupObject,
			profileType: backupObject?.data?.profile?.type,
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
const getServiceName = (clientName) => {
	return clientName ? clientName.replace("-client", "") : ""
}

const restoreStatus = ref()
const restoreErrorLog = ref({})
const isRestoreHasErrors = computed(() => {
	if (!restoreErrorLog.value) return false
	for (const _ in restoreErrorLog.value) return true
	return false
})
function handleShowRestoreErrorLog() {
	if (!isRestoreHasErrors.value) return

	cacheStore.viewerData = restoreErrorLog.value
	popupStore.open("data_viewer")
}
function processRestoredData(serviceName, data) {
	if (!Array.isArray(data) || !data.length || !serviceName) return

	let restoreErrors = []
	if (serviceName === "account-state") {
		for (const item of data) {
			const failedContracts = item.contracts.filter((c) => c.restoreError)
			const failedSenders = item.senders.filter((s) => s.restoreError)

			if (!failedContracts.length && !failedSenders.length) continue

			restoreErrors.push({
				networkId: item.networkId,
				contracts: failedContracts,
				senders: failedSenders,
			})
		}
	} else {
		restoreErrors = data.filter((item) => item.restoreError)
	}

	if (!restoreErrors.length) return

	restoreErrorLog.value[serviceName] = restoreErrors
}
async function handleRestoreBackup() {
	if (!isAllowedToImportBackup.value) return

	fillError()
	restoreStatus.value = "progress"
	const { checksum, ...backup } = selectedBackup.value.backup
	const comparisonChecksum = await EncryptionKey.getHashHex(JSON.stringify(backup))

	if (checksum !== comparisonChecksum) {
		restoreStatus.value = "failed"
		fillError(
			"full_backup",
			"Backup Integrity Check Failed",
			"The backup file appears to be corrupted or has been tampered with. Please ensure you have the correct backup file.",
		)
		return
	}

	try {
		restoreErrorLog.value = {}
		const masterKey = backup["master-key"]

		const profileService = new ProfileServiceClient()
		const profile = backup?.data?.profile
		const newProfile = await profileService.restore(profile, masterKey, password.value)
		profileService.disconnect()

		if (newProfile.restoreError) {
			restoreStatus.value = "failed"
			fillError("full_backup", "Import failed", newProfile.restoreError)

			return
		}
		// Patch backup with new profileId
		if (newProfile.id !== profile.id) {
			for (const key of Object.keys(backup?.data)) {
				const value = backup.data[key]

				if (Array.isArray(value)) {
					backup.data[key] = value.map((item) => {
						if (item && typeof item === "object" && "profileId" in item) {
							return { ...item, profileId: newProfile.id }
						}
						return item
					})
				}
			}
		}

		const networkService = new NetworkServiceClient()
		const newNetworks = await networkService.restore(backup.data.network)
		networkService.disconnect()
		const createdNetworks = newNetworks.filter((n) => !n.restoreError)
		if (!createdNetworks.length) {
			try {
				await profileService.deleteProfile(newProfile.id)
			} catch (err) {
				console.error(err)
			} finally {
				profileService.disconnect()
			}

			restoreStatus.value = "failed"
			fillError("full_backup", "Import failed", "Unable to restore any networks, import aborted")

			return
		}
		// Patch backup with new networkId
		for (const network of newNetworks) {
			const oldNetwork = backup.data.network.find(
				(n) => n.name === network.name && n.rpcUrl === network.rpcUrl && n.chainId === network.chainId,
			)

			if (oldNetwork && oldNetwork.id !== network.id) {
				for (const key of Object.keys(backup?.data)) {
					const value = backup.data[key]

					if (Array.isArray(value)) {
						backup.data[key] = value.map((item) => {
							if (item && typeof item === "object" && "networkId" in item) {
								return { ...item, networkId: network.id }
							}
							return item
						})
					}

					// ??? Maybe it's better to do it this way? ???
					//
					// if (Array.isArray(value)) {
					// 	backup.data[key] = value.flatMap(item => {
					// 		if (item && typeof item === "object" && "networkId" in item) {
					// 			if (network.restoreError) return []

					// 			return [{ ...item, networkId: network.id }]
					// 		}
					// 		return [item]
					// 	})
					// }
				}
			}
		}
		processRestoredData(getServiceName(networkService.name), newNetworks)

		const accountService = new AccountServiceClient()
		try {
			const newAccounts = await accountService.restore(backup.data.account)
			accountService.disconnect()
			processRestoredData(getServiceName(accountService.name), newAccounts)
		} catch (err) {
			if (err === "Duplicate address") {
				try {
					await profileService.deleteProfile(newProfile.id)
				} catch (err) {
					console.error(err)
				} finally {
					fillError("full_backup", "Import failed", "Profile already exists, import aborted")
					profileService.disconnect()
				}

				restoreStatus.value = "failed"
				return
			}
		}

		const tokenService = new TokenServiceClient()
		const newTokens = await tokenService.restore(backup.data.token)
		tokenService.disconnect()
		// Patch backup with new token ids
		if (backup.data["token-balance"]?.length) {
			const oldIdToContract = new Map(backup.data.token.map((t) => [t.id, t.contract]))
			const contractToNewId = new Map(newTokens.filter((t) => !t.restoreError).map((t) => [t.contract, t.id]))
			backup.data["token-balance"] = backup.data["token-balance"].flatMap((tb) => {
				const contract = oldIdToContract.get(tb.token)
				const newId = contractToNewId.get(contract)
				return newId ? [{ ...tb, token: newId }] : []
			})
		}
		processRestoredData(getServiceName(tokenService.name), newTokens)

		const backupServices = [
			new TransactionServiceClient(),
			new TokenBalanceServiceClient(),
			new AccountStateServiceClient(),
			new AuthRegistryServiceClient(),
			new FpcServiceClient(),
			new ContactServiceClient(),
			new ConfigServiceClient(),
		]

		for (const s of backupServices) {
			const serviceName = getServiceName(s.name)
			const data = backup.data[serviceName]
			if (Array.isArray(data)) {
				const restoredData = serviceName === "account-state" ? await s.restore(data, createdNetworks) : await s.restore(data)
				s.disconnect()
				processRestoredData(serviceName, restoredData)
			}
		}

		restoreStatus.value = "finished"
		if (!isRestoreHasErrors.value) {
			completeImport(newProfile)

			return
		}

		importedProfile.value = newProfile
	} catch (err) {
		restoreStatus.value = ""

		fillError("full_backup", "Import failed", err)
		console.error(err.message || err)

		return
	}
}

function clearPopup() {
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

const onKeydown = (e) => {
	if (e.key === "Enter") {
		if (selectedBackup.value?.type === "encrypted" && !selectedBackup.value?.profileType) {
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
			profileName.value = `My Profile${profiles?.length ? ` ${profiles?.length}` : ""}`

			document.addEventListener("keydown", onKeydown)
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

						<Flex v-if="selectedBackup?.type === 'encrypted' && !selectedBackup?.profileType" direction="column" gap="12">
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
							v-if="selectedBackup?.type === 'encrypted' &&  !selectedBackup?.profileType"
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
							Import {{ selectedBackup?.backup?.data?.profile?.name ?? "Profile" }}
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
