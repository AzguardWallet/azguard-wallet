<route lang="json">
{
	"meta": {
		"title": "Full Backup",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"

/** Services */
import { managers } from "@/utils/core"
import { BackupServiceClient } from "@/wallet/services/backup/client"

/** Utils */
import { downloadFile } from "@/utils"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()
const { handleExternalLink } = useExternalLink()

const backupHelpUrl = "https://azguardwallet.io/help/wallet-setup/backup-methods"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const route = useRoute()
const router = useRouter()

// Reached from the profile-reset flow (?returnTo=reset): offer "Continue to
// delete profile" once the backup has actually been downloaded.
const isResetFlow = computed(() => route.query.returnTo === "reset")
const showContinueReset = ref(false)
const handleContinueReset = () => {
	router.push("/popup/general")
	popupStore.open("reset")
}

// NOTE: plain string on purpose — the file is large, keep it out of reactivity
let backupFile = ""

const isPasskeyProfile = computed(() => appStore.profile.type === "passkey")
const password = ref()
const repeatedPassword = ref()
const isWrongPassword = ref(false)
const isPasswordMismatch = ref(false)

const isAgreed = ref(false)
const handleAgree = () => {
	isAgreed.value = true
}

const backupStatus = ref("")
const isEncrypted = ref(false)
const showEncryptInputs = ref(false)

async function handleCreateEncrypted() {
	if (isPasskeyProfile.value) {
		if (!showEncryptInputs.value) {
			showEncryptInputs.value = true
			return
		}
		if (!password.value) return
		if (password.value !== repeatedPassword.value) {
			isPasswordMismatch.value = true
			return
		}
	}

	await createBackup(true)
}

async function handleCreatePlain() {
	await createBackup(false)
}

async function createBackup(encrypt) {
	let key

	try {
		if (isPasskeyProfile.value) backupStatus.value = "waiting-for-authentication"

		key = await managers.profile.exportPlain(
			appStore.profile.id,
			isPasskeyProfile.value ? undefined : password.value,
		)
	} catch (error) {
		if (!isPasskeyProfile.value) {
			isWrongPassword.value = true
		} else {
			openToast({ label: "Failed to authenticate by passkey", icon: "warning" }, 2000)
			router.go(-1)
		}

		return
	}

	backupStatus.value = "progress"
	const backupClient = new BackupServiceClient()
	try {
		// NOTE: for a password profile the profile password also seals the backup, as before
		backupFile = await backupClient.fetchExport(key, encrypt ? password.value : undefined)
	} catch (error) {
		console.error("Failed to create the backup", error)
		openToast({ label: "Failed to create the backup", icon: "warning" }, 2000)
		backupStatus.value = ""
		return
	} finally {
		backupClient.disconnect()
	}

	isEncrypted.value = encrypt
	backupStatus.value = "finished"
}
async function handleDownloadBackup() {
	let filename = `_${appStore.profile.name.replace(" ", "_")}_${Math.floor(Date.now() / 1000)}`
	filename = isEncrypted.value
		? `AzguardWalletEncryptedBackup${filename}.txt`
		: `AzguardWalletBackup${filename}.json`

	try {
		await downloadFile({
			data: backupFile,
			filename,
			compressionFormat: "gzip",
		})

		openToast({ label: "Backup downloaded successfully", icon: "download" }, 2000)

		if (isResetFlow.value) {
			showContinueReset.value = true
		}
	} catch (err) {
		console.error("Download failed:", err.message || err);
		openToast({ label: "Failed to download backup", icon: "warning" }, 2000)
	}
}

const onKeydown = e => {
	if (!isAgreed.value) return

	if (e.key === "Enter") {
		if (backupStatus.value === "finished") {
			handleDownloadBackup()
		} else {
			handleCreateEncrypted()
		}
	}
}

onMounted(() => {
	document.addEventListener("keydown", onKeydown)
})
onBeforeUnmount(() => {
	document.removeEventListener("keydown", onKeydown)
})
</script>

<template>
	<Flex direction="column" gap="24" :class="$style.wrapper">
		<Breadcrumbs hide-title />

		<PageHeader
			icon="package"
			iconColor="primary"
			title="Full Backup"
			description="Full backup includes your master key and all profile data so you can restore current state of your wallet anytime."
		>
			<template v-if="backupStatus === 'finished'" #rightdownicon>
				<Icon
					size="22"
					:color="isEncrypted ? 'green' : 'red'"
					:name="isEncrypted ? 'lock' : 'lock-unlock'"
					:class="$style.right_down_icon" />
			</template>
		</PageHeader>

		<template v-if="!isAgreed">
			<Banner variant="warning" direction="vertical">
				<template #title> Before you continue </template>
				<template #description>
					<Flex direction="column" gap="8">
						<Text height="140">
							Backup provides direct, unrestricted access to your entire profile.
						</Text>
						<Text height="140"> Ensure that your backup is stored securely and never shared with anyone. </Text>
						<Text height="140"> By continuing you agree to all risks and responsibilities. </Text>
						<a
							:href="backupHelpUrl"
							target="_blank"
							rel="noopener noreferrer"
							@click="handleExternalLink($event, backupHelpUrl)"
						>
							<Text color="blue" height="140"> Read more about backups </Text>
						</a>
					</Flex>
				</template>
			</Banner>

			<Button @click="handleAgree" type="secondary" size="medium" right-icon="arrow-right-circle" wide>
				Agree & Continue
			</Button>
		</template>
		<template v-else-if="isAgreed">
			<template v-if="!backupStatus">
				<Input
					v-if="!isPasskeyProfile"
					v-model="password"
					@click="isWrongPassword = false"
					@input="isWrongPassword = false"
					type="password"
					label="Password"
					placeholder="Enter password"
					autofocus
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isWrongPassword" align="center" gap="4">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Wrong password </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Banner variant="info" direction="vertical">
					<template #title> Protecting the backup </template>
					<template #description>
						<Text height="140">
							We strongly recommend the encrypted backup.
							{{ isPasskeyProfile ? "The" : "Your profile" }} password will be
							required to restore it.
						</Text>
					</template>
				</Banner>

				<Flex v-if="showEncryptInputs" direction="column" gap="8">
					<Input
						v-model="password"
						@click="isPasswordMismatch = false"
						@input="isPasswordMismatch = false"
						type="password"
						label="Password"
						placeholder="Enter password"
						autofocus
					>
						<template #right>
							<Transition name="fade">
								<Flex v-if="isPasswordMismatch" align="center" gap="4">
									<Icon name="warning" size="12" color="red" />
									<Text size="12" weight="600" color="primary"> Passwords do not match </Text>
								</Flex>
							</Transition>
						</template>
					</Input>
					<Input
						v-model="repeatedPassword"
						@click="isPasswordMismatch = false"
						@input="isPasswordMismatch = false"
						type="password"
						placeholder="Repeat password"
					/>
				</Flex>

				<Button
					@click="handleCreateEncrypted"
					type="secondary"
					size="medium"
					right-icon="key"
					wide
					:disabled="!isPasskeyProfile && (!password || isWrongPassword)"
				>
					Create Encrypted Backup
				</Button>
				<Button
					@click="handleCreatePlain"
					type="secondary"
					size="medium"
					right-icon="arrow-right-circle"
					wide
					:disabled="!isPasskeyProfile && (!password || isWrongPassword)"
				>
					Create Plain Backup
				</Button>
			</template>

			<Flex
				v-else-if="backupStatus === 'waiting-for-authentication'"
				align="center"
				justify="center"
				style="flex: 1;"
			>
				<Text size="14" weight="600" color="secondary"> Waiting for passkey... </Text>
			</Flex>

			<Flex v-else-if="backupStatus" direction="column" gap="12">
				<Banner v-if="backupStatus === 'finished' && !isEncrypted" variant="info" direction="vertical">
					<template #title> Backup is ready </template>
					<template #description>
						<Text height="140"> The backup is not encrypted — store it securely. </Text>
					</template>
				</Banner>

				<Banner v-if="backupStatus === 'finished' && isEncrypted" variant="done" direction="vertical">
					<template #title> Backup is ready and encrypted </template>
					<template #description>
						<Text color="secondary" height="140">
							Don't forget your 
							<Text v-if="!isPasskeyProfile" color="primary">profile</Text>
							password, as it will be required to restore your backup.
						</Text>
					</template>
				</Banner>

				<Button
					@click="handleDownloadBackup"
					type="secondary"
					size="medium"
					:right-icon="backupStatus !== 'progress' ? 'download' : ''"
					wide
					:loading="backupStatus === 'progress'"
					:disabled="backupStatus !== 'finished'"
				>
					{{ backupStatus === 'progress' ? 'Creating Backup' : 'Download Backup' }}
				</Button>
			</Flex>
		</template>

		<Button
			v-if="showContinueReset"
			@click="handleContinueReset"
			type="red"
			size="medium"
			wide
			right-icon="trash"
		>
			Continue to delete profile
		</Button>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.right_down_icon {
	position: absolute;
	z-index: 10;
	bottom: -2px;
	right: -2px;

	padding: 3px;
	background-color: var(--card-bg);
	border-radius: 50%;
}
</style>
