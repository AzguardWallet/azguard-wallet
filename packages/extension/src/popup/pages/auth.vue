<route lang="json">
{
	"meta": {
		"isAuthRequired": false
	}
}
</route>

<script setup>
/** Composables */
import { checkNotificationsForShow } from "@/composables/notification"

/** Utils */
import { Config } from "@/wallet/config"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { getLastActiveProfileId, setLastActiveProfileId } from "@/utils/lastActiveProfile"
import { initTransactionService, managers, refreshBalances } from "@/utils/core"
import { sleep } from "@/wallet/utils"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

if (appStore.isLogined) {
	router.go(-1)
}

const defaultConfig = new Config()
const theme = ref(defaultConfig.theme)
const isSidePanelEnabled = ref(defaultConfig.sidePanel)

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const passwordInput = ref(null)
const password = ref("")
const isWrongPassword = ref(false)
const isPasswordType = ref(true)

const isPasskeyProfile = computed(() => appStore.profile?.type === "passkey")

const handlePasswordInput = () => {
	if (isWrongPassword.value) isWrongPassword.value = false
}

const isAllowedToContinue = computed(() => {
	if (isPasskeyProfile.value) return true
	if (!password.value.length) return false
	if (isWrongPassword.value) return false

	return true
})

const isAwaitingResponse = ref(false)
const handleUnlockWallet = async () => {
	if (!isAllowedToContinue.value) return

	try {
		let activeProfile
		try {
			isAwaitingResponse.value = true
			activeProfile = isPasskeyProfile.value
				? await managers.profile.unlockPasskeyProfile(appStore.profile.id)
				: await managers.profile.unlockProfile(appStore.profile.id, password.value)
			while (!appStore.isLogined) {
				await sleep(100) // wait for services initialization
			}
		} catch (error) {
			if (error === "Invalid profile password") {
				isWrongPassword.value = true
			}

			return
		} finally {
			isAwaitingResponse.value = false
		}

		password.value = ""

		appStore.profile = activeProfile
		if (activeProfile?.id) await setLastActiveProfileId(activeProfile.id)
		managers.account = new AccountServiceClient()

		initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)

		await appStore.syncTransactions()
		refreshBalances(10, appStore.accounts)

		router.push(appStore.pageAwaitingAuth || "/popup/general")

		await checkNotificationsForShow(router)
	} catch (err) {
		console.error(err)
	}
}

function onSettingUpdate(setting) {
	if (setting.key === "theme") {
		theme.value = setting.value
	}
}

async function handleSwitchTheme() {
	try {
		const newTheme = theme.value === "dark" ? "light" : "dark"
		await configService.setValue("theme", newTheme)
		theme.value = newTheme
	} catch (err) {
		console.error(`Failed theme updating ${err}`)
	}
}

async function handleSwitchAppView() {
	try {
		await configService.setValue("sidePanel", !isSidePanelEnabled.value)
		isSidePanelEnabled.value = !isSidePanelEnabled.value
		if (isSidePanelEnabled.value) {
			const currentWindow = await chrome.windows.getCurrent()
			chrome.sidePanel.open({
				windowId: currentWindow.id,
			})
		}

		window.close()
	} catch (err) {
		console.error(`Failed side panel updating ${err}`)
	}
}

const handleSelectProfile = () => {
	popupStore.open("select_profile")
}

const focusPasswordInput = () => {
	passwordInput.value?.focus()
}

onMounted(async () => {
	if (!isPasskeyProfile.value) {
		passwordInput.value?.focus()
	}

	theme.value = await configService.getValue("theme")
	isSidePanelEnabled.value = await configService.getValue("sidePanel")

	const lastActiveProfileId = await getLastActiveProfileId()
	if (lastActiveProfileId) {
		const profile = (await managers.profile.getProfiles())?.find((p) => p.id === lastActiveProfileId)
		if (profile) {
			appStore.profile = profile
		}
	}
})
onBeforeUnmount(() => {
	configService.disconnect()
})

watch(
	() => appStore.isLogined,
	async () => {
		if (appStore.isLogined) {
			router.push(appStore.pageAwaitingAuth || "/popup/general")
		}
	},
)
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<!-- Top row: NULO wordmark + settings toggles -->
		<Flex align="center" justify="between" :class="$style.top_row">
			<div :class="$style.spacer" />
			<span :class="$style.wordmark">NULO</span>
			<Flex align="center" gap="4">
				<button @click="handleSwitchTheme" :class="$style.icon_btn" type="button" aria-label="Toggle theme">
					<MaterialIcon :name="theme === 'dark' ? 'light_mode' : 'dark_mode'" :size="18" color="secondary" />
				</button>
				<button @click="handleSwitchAppView" :class="$style.icon_btn" type="button" aria-label="Toggle side panel">
					<MaterialIcon name="dock_to_right" :size="18" color="secondary" />
				</button>
			</Flex>
		</Flex>

		<!-- Main content -->
		<Flex direction="column" align="center" gap="32" :class="$style.main">
			<!-- Compact profile pill -->
			<button
				@click="handleSelectProfile"
				type="button"
				data-testid="auth-profile"
				:class="$style.profile_pill"
			>
				<Flex align="center" gap="12">
					<div :class="$style.profile_icon_box">
						<MaterialIcon name="person" :size="16" color="secondary" />
					</div>
					<Flex direction="column" align="start" gap="2">
						<span :class="$style.profile_label">Current Profile</span>
						<span :class="$style.profile_name">{{ appStore.profile?.name ?? '' }}</span>
					</Flex>
				</Flex>
				<MaterialIcon name="chevron_right" :size="18" color="secondary" />
			</button>

			<!-- Heading + subheading. Small inline lock glyph preserves the
			     "secure gate" cue we lost when we dropped the standalone
			     48px lock icon from above the profile pill. -->
			<Flex direction="column" align="center" gap="8">
				<Flex align="center" justify="center" gap="8">
					<MaterialIcon name="lock" :size="16" color="primary" />
					<h1 :class="$style.heading">
						{{ isPasskeyProfile ? 'Passkey required' : 'Password required' }}
					</h1>
				</Flex>
				<p :class="$style.subheading">
					{{ isPasskeyProfile ? 'Use your passkey to continue' : 'Enter your profile password to continue' }}
				</p>
			</Flex>

			<!-- Form -->
			<form @submit.prevent="handleUnlockWallet" :class="$style.form">
				<template v-if="!isPasskeyProfile">
					<div
						@click="focusPasswordInput"
						:class="[$style.input_wrapper, isWrongPassword && $style.input_error, isWrongPassword && $style.shake]"
					>
						<input
							ref="passwordInput"
							v-model="password"
							@input="handlePasswordInput"
							:type="isPasswordType ? 'password' : 'text'"
							placeholder="Enter password"
							data-testid="auth-password-input"
							autocomplete="current-password"
							spellcheck="false"
							autocapitalize="none"
							autocorrect="off"
							:aria-invalid="isWrongPassword"
							:class="$style.password_input"
						/>
						<button
							type="button"
							@click="isPasswordType = !isPasswordType"
							:class="$style.visibility_btn"
							:aria-label="isPasswordType ? 'Show password' : 'Hide password'"
						>
							<MaterialIcon
								:name="isPasswordType ? 'visibility' : 'visibility_off'"
								:size="18"
								color="secondary"
							/>
						</button>
					</div>
					<Transition name="fade">
						<span v-if="isWrongPassword" :class="$style.error_text" role="alert">Wrong password</span>
					</Transition>
				</template>

				<button
					type="submit"
					data-testid="auth-submit"
					:disabled="!isAllowedToContinue || isAwaitingResponse"
					:class="$style.continue_btn"
				>
					<Spinner v-if="isAwaitingResponse" size="14" color="#0a0908" />
					<template v-else>Continue</template>
				</button>
			</form>
		</Flex>

		<!-- Footer -->
		<Flex justify="center" :class="$style.footer">
			<button
				@click="popupStore.open('forgot_password')"
				type="button"
				data-testid="auth-reset"
				:class="$style.reset_link"
			>
				Reset Profile
			</button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;

	background: var(--app-bg);

	padding: 24px;
}

.top_row {
	margin-bottom: 24px;
}

.spacer {
	width: 60px;
}

.wordmark {
	font-family: var(--font-headline);
	font-size: 20px;
	font-weight: 700;
	letter-spacing: -0.04em;
	text-transform: uppercase;
	color: var(--txt-primary);
}

.icon_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 28px;
	height: 28px;

	background: transparent;
	border: none;
	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}
}

.main {
	flex: 1;
	justify-content: center;

	padding: 0 8px;
}

.profile_pill {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	width: 100%;
	max-width: 280px;

	background: var(--nulo-surface-low);
	border: 1px solid var(--nulo-border);
	cursor: pointer;

	padding: 10px 14px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
		border-color: var(--nulo-outline);
	}
}

.profile_icon_box {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 32px;
	height: 32px;

	background: var(--nulo-surface-highest);
	border: 1px solid var(--nulo-border);

	flex-shrink: 0;
}

.profile_label {
	font-family: var(--font-mono);
	font-size: 9px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--nulo-secondary);
}

.profile_name {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 500;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
	max-width: 180px;

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.heading {
	font-family: var(--font-headline);
	font-size: 24px;
	font-weight: 600;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
	margin: 0;
	line-height: 1.2;
}

.subheading {
	font-family: var(--font-body);
	font-size: 13px;
	color: var(--nulo-secondary);
	text-align: center;
	margin: 0;
	line-height: 1.4;
}

.form {
	display: flex;
	flex-direction: column;
	gap: 16px;

	width: 100%;
	max-width: 320px;
}

.input_wrapper {
	position: relative;
	display: flex;
	align-items: center;

	border-bottom: 1px solid var(--nulo-border);
	padding: 12px 0;
	cursor: text;

	transition: border-color 0.2s var(--bezier);

	&:focus-within {
		border-bottom-color: var(--nulo-accent);
	}
}

.input_error {
	border-bottom-color: var(--red);
}

.password_input {
	flex: 1;

	background: transparent;
	border: none;
	outline: none;
	padding: 0;

	font-family: var(--font-body);
	font-size: 15px;
	font-weight: 500;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--nulo-outline);
	}
}

.visibility_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	background: transparent;
	border: none;
	cursor: pointer;

	padding: 4px 0 4px 8px;
}

.error_text {
	font-family: var(--font-body);
	font-size: 12px;
	color: var(--red);

	margin-top: -8px;
}

.continue_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 100%;
	padding: 16px 0;

	background: var(--nulo-accent);
	color: #0a0908;

	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.2em;
	text-transform: uppercase;

	border: none;
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover:not(:disabled) {
		background: #fff;
	}

	&:active:not(:disabled) {
		transform: scale(0.98);
	}

	&:disabled {
		opacity: 0.3;
		pointer-events: none;
	}
}

.footer {
	margin-top: 24px;
	padding: 8px;
}

.reset_link {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.2em;
	text-transform: uppercase;
	color: var(--nulo-secondary);

	background: transparent;
	border: none;
	cursor: pointer;

	padding: 4px 0;
	border-bottom: 1px solid transparent;

	transition: all 0.2s var(--bezier);

	&:hover {
		color: var(--nulo-accent);
		border-bottom-color: var(--nulo-accent);
	}
}

@keyframes shakeInput {
	0% { transform: translateX(0); }
	20% { transform: translateX(-4px); }
	40% { transform: translateX(4px); }
	60% { transform: translateX(-3px); }
	80% { transform: translateX(2px); }
	100% { transform: translateX(0); }
}

.shake {
	animation: shakeInput 0.3s ease;
}
</style>
