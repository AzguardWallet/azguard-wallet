<route lang="json">
{
	"meta": {
		"isAuthRequired": false
	}
}
</route>

<script setup>
/** Utils */
import { AccountServiceClient } from "@/wallet/services/account/client"
import { managers, initTokenService, initTransactionService } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const route = useRoute()
const router = useRouter()

if (appStore.isLogined) {
	router.go(-1)
}

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
		isAwaitingResponse.value = true
		const activeProfile = await managers.profile.unlockProfile(appStore.profile.id, password.value)
		isAwaitingResponse.value = false

		if (!activeProfile) {
			isWrongPassword.value = true
			return
		}

		password.value = ""

		appStore.profile = activeProfile
		managers.account = new AccountServiceClient(appStore.profile, appStore.network)

		initTokenService({
			profile: appStore.profile,
			network: appStore.network,
			account: appStore.account,
		})
		initTransactionService(() => {
			appStore.isAwaitingTransaction = false
		})

		managers.profile.onLocked = () => {
			appStore.isLogined = false
			router.push("/popup/auth")
		}

		await appStore.syncLocalTokens()
		appStore.syncBalances()
		await appStore.syncTransactions()
		appStore.initBalanceListeners()

		appStore.isLogined = true
		
		if (appStore.pageAwaitingAuth) {
			router.go(-1)
			appStore.pageAwaitingAuth = ""
		} else {
			router.push("/popup/general")
		}
	} catch (err) {
		console.log(err)
	}
}

const onKeydown = e => {
	if (e.key === "Enter") handleUnlockWallet()
}

onMounted(() => {
	inputElement.value.inputEl.focus()

	document.addEventListener("keydown", onKeydown)
})
onBeforeUnmount(() => {
	document.removeEventListener("keydown", onKeydown)
})

watch(
	() => appStore.isLogined,
	() => {
		router.push("/popup/general")
	},
)
</script>

<template>
	<Flex direction="column" jusitfy="between" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="40" style="flex: 1">
			<Flex align="center" justify="center" :class="$style.lock_badge">
				<Icon name="logo" size="40" :class="$style.logo_icon" />
				<Icon
					name="lock"
					size="20"
					:color="isWrongPassword ? 'red' : 'orange'"
					:class="[$style.lock_icon, isWrongPassword && $style.shake]"
				/>
			</Flex>

			<Flex align="center" direction="column" gap="16">
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
							@click="isPasswordType = !isPasswordType"
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

		<Flex align="center" direction="column" gap="12">
			<Button @click="popupStore.open('forgot_password')" type="secondary" size="mini">
				<Icon name="info" size="16" color="primary" /> Forgot Password
			</Button>

			<Text size="12" weight="500" color="support" height="140" align="center">
				The session has ended and the wallet has been locked. See "Forgot Password" for options.
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 80px 24px 24px 24px;
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
