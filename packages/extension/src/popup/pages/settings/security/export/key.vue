<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Services */
import { managers } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()
const { handleExternalLink } = useExternalLink()

const backupHelpUrl = "https://nulo.sh/help/wallet-setup/backup-methods"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const isStarted = ref(false)
const isUnlocked = ref(false)

const password = ref()
const isWrongPassword = ref(false)

const publicKey = ref()
const publicKeyFieldType = ref("password")
const togglePublicKeyFieldType = () => {
	publicKeyFieldType.value = publicKeyFieldType.value === "password" ? "text" : "password"
}

const privateKey = ref()
const privateKeyFieldType = ref("password")
const togglePrivateKeyFieldType = () => {
	privateKeyFieldType.value = privateKeyFieldType.value === "password" ? "text" : "password"
}

const selectedKey = ref()
/** get public key */
watch(
	() => selectedKey.value,
	async () => {
		if (selectedKey.value === "public") {
			try {
				publicKey.value = await managers.profile.exportEncrypted(appStore.profile.id)
			} catch (error) {}
		}
	},
)
const handleSelectKey = (key) => {
	selectedKey.value = key
}

const handleStart = () => {
	isStarted.value = true
}

const closeTimeout = ref()
const handleUnlock = async () => {
	if (!password.value) return

	try {
		privateKey.value = await managers.profile.exportPlain(appStore.profile.id, password.value)

		password.value = null
		isUnlocked.value = true

		closeTimeout.value = setTimeout(() => {
			handleClose()
		}, 60_000 * 2)
	} catch (error) {
		isWrongPassword.value = true
	}
}

const isCopied = ref(false)
const handleCopy = (key) => {
	isCopied.value = true
	window.navigator.clipboard.writeText(key === "private" ? privateKey.value : publicKey.value)
	openToast({ label: "Key is copied", icon: "copy" })
	setTimeout(() => {
		isCopied.value = false
	}, 2500)
}

const handleClose = () => {
	privateKey.value = null
	publicKey.value = null

	router.push("/popup/settings/security/export")
}

const isAutoCloseDisabled = ref(false)
const handleDisableAutoClose = () => {
	clearTimeout(closeTimeout.value)
	isAutoCloseDisabled.value = true
}

const onKeydown = (e) => {
	if (e.key === "Enter") handleUnlock()
}

watch(
	() => isStarted.value,
	() => {
		if (isStarted.value && selectedKey.value === "private") document.addEventListener("keydown", onKeydown)
	},
)
onBeforeUnmount(() => {
	privateKey.value = null
	publicKey.value = null

	document.removeEventListener("keydown", onKeydown)

	clearTimeout(closeTimeout.value)
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader :backTo="'/popup/settings/security/export'" />

		<Flex direction="column" gap="24" :class="$style.content">
			<PageHeader
				icon="key"
			:iconColor="
				(!selectedKey && 'primary') ||
				(selectedKey === 'private' && 'red') ||
				(selectedKey === 'public' && 'green')
			"
			:title="
				(!selectedKey && 'Secret Key') ||
				(selectedKey === 'private' && 'Plain Key') ||
				(selectedKey === 'public' && 'Encrypted Key')
			"
			description="Secret key can be used to restore your profile, either with or without a password"
		/>

		<ItemsContainer v-if="!selectedKey" title="Select type of the key">
			<SettingItem
				@click="handleSelectKey('public')"
				size="large"
				title="Encrypted"
				description="Password is required to use"
				icon="lock"
				iconBgColor="green"
				chevron
			/>
			<SettingItem
				@click="handleSelectKey('private')"
				size="large"
				title="Plain"
				description="Password is required to receive"
				icon="eye"
				iconBgColor="red"
				chevron
			/>
		</ItemsContainer>

		<!-- Private Key -->
		<template v-if="selectedKey === 'private'">
			<template v-if="!isStarted">
				<Banner variant="warning" direction="vertical">
					<template #title> Before you continue </template>
					<template #description>
						<Flex direction="column" gap="8">
							<Text height="140">
								Plain key is direct and full access to your entire profile, once you lose it you will
								not be able to regain access to your profile.
							</Text>
							<Text height="140"> Ensure that plain key is securely stored. </Text>
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

				<Button @click="handleStart" type="secondary" size="medium" right-icon="arrow-right-circle" wide>
					Agree & Continue
				</Button>
			</template>
			<template v-else-if="isStarted && !isUnlocked">
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
					@click="handleUnlock"
					type="secondary"
					size="medium"
					right-icon="arrow-right-circle"
					wide
					:disabled="!password"
				>
					Retrieve Secret Key
				</Button>
			</template>
			<template v-else>
				<Flex direction="column" gap="8">
					<Input v-model="privateKey" :type="privateKeyFieldType" label="Plain Key" placeholder="Plain Key">
						<template v-if="isUnlocked" #suffix>
							<Icon
								@click.stop="togglePrivateKeyFieldType"
								:name="privateKeyFieldType === 'password' ? 'text' : 'password'"
								size="16"
								color="secondary"
								style="cursor: pointer"
							/>

							<Icon
								@click.stop="handleCopy('private')"
								:name="isCopied ? 'check' : 'copy'"
								size="12"
								:color="isCopied ? 'green' : 'secondary'"
								style="cursor: pointer"
							/>
						</template>
					</Input>

					<Text size="12" weight="500" height="150" color="tertiary">
						Recovery with this key is instant, without a password
					</Text>
				</Flex>

				<Flex direction="column" align="center" gap="12">
					<Button @click="handleClose" type="secondary" size="medium" wide>
						Close
						<div v-if="!isAutoCloseDisabled" :class="$style.progress_bar" />
					</Button>

					<Text
						v-if="!isAutoCloseDisabled"
						size="12"
						weight="500"
						height="150"
						color="tertiary"
						align="center"
						style="padding: 0 24px"
					>
						You have 5 minutes before the key is hidden and the password is required again
					</Text>

					<Text
						v-if="!isAutoCloseDisabled"
						@click="handleDisableAutoClose"
						size="12"
						weight="600"
						color="blue"
						class="clickable"
					>
						Disable auto-close
					</Text>
				</Flex>
			</template>
		</template>

		<!-- Public Key -->
		<template v-if="selectedKey === 'public'">
			<Flex direction="column" gap="8">
				<Input v-model="publicKey" :type="publicKeyFieldType" label="Encrypted Key" placeholder="Encrypted Key">
					<template #suffix>
						<Icon
							@click.stop="togglePublicKeyFieldType"
							:name="publicKeyFieldType === 'password' ? 'text' : 'password'"
							size="16"
							color="secondary"
							style="cursor: pointer"
						/>

						<Icon
							@click.stop="handleCopy('public')"
							:name="isCopied ? 'check' : 'copy'"
							size="12"
							:color="isCopied ? 'green' : 'secondary'"
							style="cursor: pointer"
						/>
					</template>
				</Input>

				<Text size="12" weight="500" height="150" color="tertiary">
					To use this key to restore your profile - you will need to enter your current password
				</Text>
			</Flex>

			<Button @click="handleClose" type="secondary" size="medium" wide> Close </Button>
		</template>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.page_icon {
	position: relative;

	& div {
		position: absolute;

		background: linear-gradient(var(--nulo-surface-highest), var(--nulo-surface-high));
		inset: -1px;
		border-radius: 13px;

		z-index: 0;
	}

	& svg {
		z-index: 1;

		border-radius: 0;
		background: var(--blue);
		box-shadow: 0 2px 4px rgba(255, 255, 255, 0.1);
		box-sizing: content-box;

		padding: 8px;
	}
}

@keyframes shrink {
	0% {
		transform: translateX(0);
	}

	100% {
		transform: translateX(-100%);
	}
}

.progress_bar {
	position: absolute;
	top: 0;
	bottom: 0;

	width: 100%;

	background: var(--nulo-surface-high);

	animation: shrink 300s linear;
	will-change: transform;
}
</style>
