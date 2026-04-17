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

const phrase = ref("Try harder")
const phraseFieldType = ref("password")
const togglePhraseFieldType = () => {
	phraseFieldType.value = phraseFieldType.value === "password" ? "text" : "password"
}

const handleStart = () => {
	isStarted.value = true
}

const closeTimeout = ref()
const handleUnlock = async () => {
	if (!password.value) return

	try {
		const mnemonic = await managers.profile.exportMnemonic(appStore.profile.id, password.value)
		phrase.value = mnemonic.join(" ")

		password.value = null
		isUnlocked.value = true

		closeTimeout.value = setTimeout(() => {
			handleClose()
		}, 60_000 * 5)
	} catch (error) {
		isWrongPassword.value = true
	}
}

const isCopied = ref(false)
const handleCopy = () => {
	isCopied.value = true
	window.navigator.clipboard.writeText(phrase.value)
	openToast({ label: "Seed phrase is copied", icon: "copy" })
	setTimeout(() => {
		isCopied.value = false
	}, 2500)
}

const handleClose = () => {
	phrase.value = null

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
		if (isStarted.value) document.addEventListener("keydown", onKeydown)
	},
)
onBeforeUnmount(() => {
	phrase.value = null

	document.removeEventListener("keydown", onKeydown)

	clearTimeout(closeTimeout.value)
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader :backTo="'/popup/settings/security/export'" />

		<Flex direction="column" gap="24" :class="$style.content">
			<Flex direction="column" align="center" gap="16" :class="$style.page_header">
			<Flex :class="$style.page_icon">
				<Icon name="text" size="24" color="primary" />
				<div />
			</Flex>

			<Flex align="center" direction="column" gap="8">
				<Text size="14" weight="600" color="primary">Seed Phrase</Text>
				<Text size="13" weight="500" height="150" color="tertiary" align="center" style="padding: 0 24px">
					Random words that stores the data required to access or recover your profile
				</Text>
			</Flex>
		</Flex>

		<template v-if="!isStarted">
			<Banner variant="warning" direction="vertical">
				<template #title> Before you continue </template>
				<template #description>
					<Flex direction="column" gap="8">
						<Text height="140">
							Seed phrase is direct and full access to your entire profile, once you lose it you will not
							be able to regain access to your profile.
						</Text>
						<Text height="140"> Ensure that seed phrase is securely stored. </Text>
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
				Retrieve Seed Phrase
			</Button>
		</template>
		<template v-else>
			<Input v-model="phrase" :type="phraseFieldType" label="Seed Phrase" placeholder="Seed Phrase">
				<template v-if="isUnlocked" #suffix>
					<Icon
						@click.stop="togglePhraseFieldType"
						:name="phraseFieldType === 'password' ? 'text' : 'password'"
						size="16"
						color="secondary"
						style="cursor: pointer"
					/>

					<Icon
						@click.stop="handleCopy"
						:name="isCopied ? 'check' : 'copy'"
						size="12"
						:color="isCopied ? 'green' : 'secondary'"
						style="cursor: pointer"
					/>
				</template>
			</Input>

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
					You have 5 minutes before the seed phrase is hidden and the password is required again
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

			<Flex direction="column" gap="12">
				<Divider>
					<Text size="12" weight="500" color="tertiary"> Keep in mind </Text>
				</Divider>

				<Flex gap="8">
					<Icon name="warning" size="12" color="tertiary" style="height: 18px" />
					<Text size="12" weight="500" height="150" color="tertiary">
						Some applications on your PC can have access to your clipboard and read a seed phrase
					</Text>
				</Flex>

				<Flex gap="8">
					<Icon name="warning" size="12" color="tertiary" style="height: 18px" />
					<Text size="12" weight="500" height="150" color="tertiary">
						Storing a text file with sensitive information like a seed phrase can be dangerous
					</Text>
				</Flex>

				<Flex gap="8">
					<Icon name="warning" size="12" color="tertiary" style="height: 18px" />
					<Text size="12" weight="500" height="150" color="tertiary">
						Storing a seed phrase in your notebook or in any other physical form can be considered one of
						the safest methods, but a paper can be easily lost or destroyed (by water or fire)
					</Text>
				</Flex>
			</Flex>
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
