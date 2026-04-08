<route lang="json">
{
	"meta": {
		"title": "Full Backup",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Services */
import { managers } from "@/utils/core"
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
import { downloadFile } from "@/utils"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()
const { handleExternalLink } = useExternalLink()

const backupHelpUrl = "https://azguardwallet.io/help/wallet-setup/backup-methods"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

let backup = {}
const backupServices = [
	new ProfileServiceClient(),
	new NetworkServiceClient(),
	new AccountServiceClient(),
	new TransactionServiceClient(),
	new TokenServiceClient(),
	new TokenBalanceServiceClient(),
	new AccountStateServiceClient(),
	new AuthRegistryServiceClient(),
	new FpcServiceClient(),
	new ContactServiceClient(),
	new ConfigServiceClient(),
]
const version = __VERSION__
const aztecVersion = __AZTEC_VERSION__

const isPasskeyProfile = computed(() => appStore.profile.type === "passkey")
const password = ref()
const repeatedPassword = ref()
const isWrongPassword = ref(false)
const isPasswordMismatch = ref(false)

const showRecommendation = ref(false)

const isAgreed = ref(false)
const handleAgree = () => {
	isAgreed.value = true

	if (isPasskeyProfile.value) {
		handleBackup()
	}
}

const backupStatus = ref("")
async function handleBackup() {
	let key = ""

	try {
		if (isPasskeyProfile.value) backupStatus.value = "waiting-for-authentication"

		key = await managers.profile.exportPlain(appStore.profile.id, password.value)
	} catch (error) {
		if (!isPasskeyProfile.value) {
			isWrongPassword.value = true
		} else {
			openToast({ label: "Failed to authenticate by passkey", icon: "warning" }, TOAST_DURATION.LONG)
			router.go(-1)
		}

		return
	}

	backupStatus.value = "progress"
	backup = {
		"wallet-version": version,
		"aztec-version": aztecVersion,
		"master-key": key,
		data: {},
	}

	for (const s of backupServices) {
		const data = await s.backup()
		s.disconnect()

		if (data === null || data === undefined) continue

		backup.data[s.name?.replace("-client", "")] = data
	}

	const checksum = await EncryptionKey.getHashHex(JSON.stringify(backup))
	backup.checksum = checksum

	backupStatus.value = "finished"
	showRecommendation.value = true
}
async function handleEncrypt() {
	if (isPasskeyProfile.value) {
		showRecommendation.value = false
		if (!password.value) return

		if (password.value !== repeatedPassword.value) {
			isPasswordMismatch.value = true
			return
		}
	}

	backupStatus.value = "encrypting"
	showRecommendation.value = false

	try {
		const passhash = await EncryptionKey.getPasshash(password.value)
		const key = await EncryptionKey.fromPasshash(passhash)
		backup = Buffer(await key.encrypt(new TextEncoder().encode(JSON.stringify(backup)))).toString("base64")

		backupStatus.value = "encrypted"
	} catch (error) {
		console.error("Failed to encrypt the backup", error)
		openToast({ label: "Failed to encrypt the backup", icon: "warning" }, TOAST_DURATION.LONG)

		backupStatus.value = "finished"
	}
}
async function handleDownloadBackup() {
	const isEncrypted = backupStatus.value === "encrypted"
	let filename = `_${appStore.profile.name.replace(" ", "_")}_${Math.floor(Date.now() / 1000)}`
	filename = isEncrypted ? `VibeguardEncryptedBackup${filename}.txt` : `VibeguardBackup${filename}.json`

	let fileContent = ""
	if (isEncrypted) {
		fileContent = backup
	} else {
		fileContent = JSON.stringify(backup, null, 2)
	}

	try {
		await downloadFile({
			data: fileContent,
			filename,
			compressionFormat: "gzip",
		})

		openToast({ label: "Backup downloaded successfully", icon: "download" })
	} catch (err) {
		console.error("Download failed:", err.message || err)
		openToast({ label: "Failed to download backup", icon: "warning" }, TOAST_DURATION.LONG)
	}
}

const onKeydown = (e) => {
	if (!isAgreed.value) return

	if (e.key === "Enter") {
		switch (backupStatus.value) {
			case "finished":
				handleEncrypt()
				break
			case "encrypted":
				handleDownloadBackup()
				break

			default:
				handleBackup()
				break
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
			<template v-if="backupStatus === 'finished' || backupStatus === 'encrypted'" #rightdownicon>
				<Icon
					size="22"
					:color="backupStatus === 'finished' ? 'red' : 'green'"
					:name="backupStatus === 'finished' ? 'lock-unlock' : 'lock'"
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
			<template v-if="!isPasskeyProfile && !backupStatus">
				<Input
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

				<Button
					@click="handleBackup"
					type="secondary"
					size="medium"
					right-icon="arrow-right-circle"
					wide
					:disabled="!password || isWrongPassword"
				>
					Create Backup
				</Button>
			</template>

			<Flex v-else-if="backupStatus === 'waiting-for-authentication'" align="center" justify="center" style="flex: 1;">
				<Text size="14" weight="600" color="secondary"> Waiting for passkey... </Text>
			</Flex>

			<Flex v-else-if="backupStatus" direction="column" gap="12">
				<Banner v-if="showRecommendation" variant="info" direction="vertical">
					<template #title> Backup is ready </template>
					<template #description>
						<Text height="140">
							You can download it right now, but we strongly recommend to encrypt it before downloading.
						</Text>
					</template>
				</Banner>

				<Flex v-if="!showRecommendation && isPasskeyProfile && backupStatus === 'finished'" direction="column" gap="8">
					<Input
						v-model="password"
						@click="isPasswordMismatch = false"
						@input="isPasswordMismatch = false"
						type="password"
						label="Password"
						placeholder="Enter password"
						autofocus
						:disabled="backupStatus === 'encrypting'"
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
						:disabled="backupStatus === 'encrypting'"
					/>
				</Flex>

				<Banner v-if="backupStatus === 'encrypted'" variant="done" direction="vertical">
					<template #title> Backup is successfully encrypted </template>
					<template #description>
						<Text color="secondary" height="140">
							Don't forget your 
							<Text v-if="!isPasskeyProfile" color="primary">profile</Text>
							password, as it will be required to restore your backup.
						</Text>
					</template>
				</Banner>

				<Flex direction="column" gap="8">
					<Button
						v-if="backupStatus === 'finished' || backupStatus == 'encrypting'"
						@click="handleEncrypt()"
						type="secondary"
						size="medium"
						right-icon="key"
						wide
						:loading="backupStatus === 'encrypting'"
						:disabled="backupStatus === 'encrypting'"
					>
						Protect with Password
					</Button>

					<Button
						@click="handleDownloadBackup"
						type="secondary"
						size="medium"
						:right-icon="backupStatus !== 'progress' ? 'download' : ''"
						wide
						:loading="backupStatus === 'progress'"
						:disabled="!backupStatus || backupStatus === 'progress' || backupStatus === 'encrypting'"
					>
						{{ backupStatus === 'progress' ? 'Creating Backup' : 'Download Backup' }}
					</Button>
				</Flex>
			</Flex>
		</template>

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
