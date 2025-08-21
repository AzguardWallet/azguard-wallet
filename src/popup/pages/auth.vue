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
import { AccountServiceClient } from "@/wallet/services/account/client"
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"
import { initTokenService, initTransactionService, managers } from "@/utils/core"
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

const theme = ref(DEFAULT_SETTINGS?.appearance?.theme || "dark")
const isSidePanelEnabled = ref(DEFAULT_SETTINGS?.appearance?.sidePanel)
let settingService = null

const inputElement = useTemplateRef("inputElement")
const password = ref("")
const isWrongPassword = ref(false)
const isPasswordType = ref(true)

const handlePasswordInput = () => {
	if (isWrongPassword.value) isWrongPassword.value = false
}

const isAllowedToContinue = computed(() => {
	if (!password.value.length) return
	if (isWrongPassword.value) return

	return true
})

const isAwaitingResponse = ref(false)
const handleUnlockWallet = async () => {
	if (!isAllowedToContinue.value) return

	try {
		let activeProfile
		try {
			isAwaitingResponse.value = true
			activeProfile = await managers.profile.unlockProfile(appStore.profile.id, password.value)
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
		managers.account = new AccountServiceClient(appStore.profile, appStore.network)

		initTokenService({
			profile: appStore.profile,
			network: appStore.network,
			account: appStore.account,
			onTokenAdded: appStore.onTokenAdded,
		})
		initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)

		await appStore.syncLocalTokens()
		appStore.syncBalances()
		await appStore.syncTransactions()
		appStore.initBalanceListeners()
		appStore.refreshBalances(10)

		router.push(appStore.pageAwaitingAuth || "/popup/general")

		await checkNotificationsForShow(router)
	} catch (err) {
		console.error(err)
	}
}

const onKeydown = e => {
	if (e.key === "Enter") handleUnlockWallet()
}

function onSettingUpdate(setting) {
	if (setting.key === "theme") {
		theme.value = setting.value
	}
}

async function handleSwitchTheme () {
	try {
		const newTheme = theme.value === "dark" ? "light" : "dark"
		await settingService.updateSetting("theme", newTheme)
		theme.value = newTheme
	} catch (err) {
		console.error(`Failed theme updating ${err}`);
	}
}

async function handleSwitchAppView () {
	try {
		await settingService.updateSetting("sidePanel", !isSidePanelEnabled.value)
		isSidePanelEnabled.value = !isSidePanelEnabled.value
		if (isSidePanelEnabled.value) {
			const currentWindow = await chrome.windows.getCurrent()
			chrome.sidePanel.open({
				windowId: currentWindow.id,
			})			
		}

		window.close()
	} catch (err) {
		console.error(`Failed side panel updating ${err}`);
	}
}

onMounted(async () => {
	inputElement.value.inputEl.focus()

	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	theme.value = (await settingService.getSetting("theme"))?.value
	isSidePanelEnabled.value = (await settingService.getSetting("sidePanel"))?.value

	document.addEventListener("keydown", onKeydown)
})
onBeforeUnmount(() => {
	document.removeEventListener("keydown", onKeydown)
})

watch(
	() => appStore.isLogined,
	async () => {
		if (appStore.isLogined) {
			router.push(appStore.pageAwaitingAuth || "/popup/general")
		}
	},
)

const handleSelectProfile = () => {
	if (appStore.profiles.length === 1) return
	popupStore.open("select_profile")
}
</script>

<template>
	<Flex direction="column" jusitfy="between" :class="$style.wrapper">
		<Flex align="center" justify="end" gap="4" wide :class="$style.settings">
			<Icon
				@click="handleSwitchTheme"
				:name="theme === 'dark' ? 'sun' : 'moon'"
				size="16"
				color="tertiary"
				:class="$style.icon"
			/>
			<Icon
				@click="handleSwitchAppView"
				name="dock-right"
				size="16"
				color="tertiary"
				:class="$style.icon"
			/>
		</Flex>

		<Flex direction="column" align="center" gap="40" style="flex: 1">
			<Flex align="center" justify="center" :class="$style.lock_badge">
				<Icon name="logo" size="40" :class="$style.logo_icon" />
				<Icon
					name="lock"
					size="20"
					:color="isWrongPassword ? 'red' : 'blue'"
					:class="[$style.lock_icon, isWrongPassword && $style.shake]"
				/>
			</Flex>

			<Flex align="center" direction="column" gap="16">
				<Flex align="center" gap="6" :class="$style.profile_badge">
					<Icon name="user" size="14" color="tertiary" />
					<Text size="13" weight="600" color="primary">{{ appStore.profile.name }}</Text>
					<!-- <Icon
						v-if="appStore.profiles.length > 1"
						name="chevron"
						size="12"
						color="tertiary"
						:class="$style.chevron_icon"
					/> -->
				</Flex>

				<Text size="24" weight="600" color="primary" style="line-height: 16px"> Password required </Text>
				<Text size="14" weight="500" color="tertiary" align="center" height="140">
					Enter your profile password to continue
				</Text>
			</Flex>

			<Flex wide direction="column" gap="24">
				<Input
					ref="inputElement"
					v-model="password"
					@input="handlePasswordInput"
					:type="isPasswordType ? 'password' : 'text'"
					placeholder="Enter password"
					label="Password"
					wide
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isWrongPassword" align="center" gap="4">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Wrong password </Text>
							</Flex>
						</Transition>
					</template>

					<template #suffix>
						<Icon
							@click.stop="isPasswordType = !isPasswordType"
							:name="isPasswordType ? 'password' : 'text'"
							size="16"
							color="secondary"
							style="cursor: pointer"
						/>
					</template>
				</Input>

				<Button
					@click="handleUnlockWallet"
					wide
					type="secondary"
					size="medium"
					rightIcon="arrow-right-circle"
					rightIconColor="primary"
					:disabled="!isAllowedToContinue"
					:loading="isAwaitingResponse"
				>
					Continue
				</Button>
			</Flex>
		</Flex>

		<Flex wide justify="center">
			<Button @click="popupStore.open('forgot_password')" type="secondary" size="mini">
				<Icon name="info" size="16" color="tertiary" />
				<Text color="secondary">Forgot Password</Text>
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 80px 24px 24px 24px;
}

.settings {
	position: absolute;
	top: 64px;
	right: 16px;

	.icon {
		box-sizing: content-box;
		border-radius: 50%;
		cursor: pointer;

		padding: 4px;

		&:hover {
			background: var(--gray-10);
			fill: var(--txt-primary);
		}
	}
}

.password_input {
	font-size: 16px;
	font-weight: 600;
	line-height: 40px;
	color: var(--txt-primary);

	border-bottom: 2px solid var(--gray-5);

	transition: border-color 0.35s var(--bezier);

	padding: 0;

	&::placeholder {
		color: var(--txt-support);
	}

	&:focus {
		border-color: var(--blue);
	}
}

.profile_badge {
	border-radius: 50px;
	background: var(--gray-5);
	cursor: pointer;

	padding: 6px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-8);
	}

	&:active {
		background: var(--gray-10);
	}
}

.chevron_icon {
	transform: rotate(-90deg);
}

.lock_badge {
	position: relative;

	background: var(--txt-primary);
	border-radius: 50%;

	padding: 4px;
}

.lock_icon {
	position: absolute;
	top: -12px;
	right: -12px;

	background: var(--card-bg);
	box-sizing: content-box;
	border-radius: 12px;

	padding: 4px;
}

.logo_icon {
	fill: var(--card-bg);
}

.shake {
	animation: shake 0.3s ease;
}

@keyframes shake {
	0% {
		transform: translateX(-1px);
	}

	25% {
		transform: translateX(2px);
	}

	50% {
		transform: translateX(-2px);
	}

	75% {
		transform: translateX(1px);
	}

	100% {
		transform: translateX(0);
	}
}
</style>
