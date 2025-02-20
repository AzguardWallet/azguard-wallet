<script setup lang="ts">
/** Local Components */
import WalletPasswordContent from "./WalletPasswordContent.vue"

/** Utils */
import { managers } from "@/utils/core"
import { AccountServiceClient, AccountType } from "@/wallet/services/account/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { sleep } from "@/wallet/utils"
const appStore = useAppStore()

const router = useRouter()

const walletPassword = ref<string>("")
const repeatedPassword = ref<string>("")

const handlePasswordInput = () => {
	if (walletPassword.value.length > 64) {
		walletPassword.value = walletPassword.value.slice(0, 64)
	}
}

const handleRepeatedPasswordInput = () => {
	if (repeatedPassword.value.length > 64) {
		repeatedPassword.value = repeatedPassword.value.slice(0, 64)
	}
}

const isCreatingProfile = ref(false)
const isAllowedToContinue = computed(() => {
	if (!walletPassword.value.length || walletPassword.value.length < 8) {
		return false
	}

	if (!repeatedPassword.value || walletPassword.value !== repeatedPassword.value) {
		return false
	}

	return true
})
const handleCreateProfile = async () => {
	if (!isAllowedToContinue.value) return

	isCreatingProfile.value = true

	const profile = await managers.profile.createProfile("My Profile", walletPassword.value)
	while (!appStore.isLogined) {
		await sleep(100) // wait for services initialization
	}

	managers.account = new AccountServiceClient(profile, appStore.network)

	appStore.profile = profile
	appStore.accounts = await managers.account.getAccounts(true)

	isCreatingProfile.value = false

	initTokenService({
		profile: appStore.profile,
		network: appStore.network,
		account: appStore.account,
		onTokenAdded: appStore.onTokenAdded,
	})
	initTransactionService(appStore.onTxAdded)

	appStore.initBalanceListeners()

	await chrome.storage.local.set({
		"azguard:ui:activeAccount": appStore.account.address,
	})

	router.push("/popup/general")

	appStore.showRegisterPopup = false
}

const handleCancel = () => {
	appStore.showRegisterPopup = false
}

const onKeydown = (e: KeyboardEvent) => {
	if (e.key === "Enter") handleCreateProfile()
}

onMounted(() => {
	document.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
	document.removeEventListener("keydown", onKeydown)
})
</script>

<template>
	<div :class="$style.wrapper">
		<Flex direction="column" :class="$style.card">
			<div :class="$style.badges_wrapper">
				<Flex align="center" gap="16" :class="$style.badges">
					<Flex align="center" gap="8" :class="[$style.badge, $style.dummy]">
						<Icon name="password" size="16" color="white" />
						<div :class="$style.rect" />
					</Flex>
					<Flex align="center" gap="8" :class="[$style.badge]">
						<Icon name="vault" size="20" color="inverse" />
						<div v-if="!walletPassword.length" :class="$style.rect" />
						<Flex v-else align="center" gap="2">
							<Icon
								v-for="_ in Math.min(8, walletPassword.length)"
								name="asterisk"
								size="10"
								color="inverse"
							/>
						</Flex>
					</Flex>
					<Flex align="center" gap="8" :class="[$style.badge, $style.dummy]">
						<Icon name="user" size="16" color="white" />
						<div :class="$style.rect" />
					</Flex>
				</Flex>
			</div>

			<Flex direction="column" justify="between" :class="$style.content">
				<WalletPasswordContent
					v-model:password="walletPassword"
					v-model:repeatedPassword="repeatedPassword"
					@onPasswordInput="handlePasswordInput"
					@onRepeatedPasswordInput="handleRepeatedPasswordInput"
				/>

				<Flex direction="column" gap="8">
					<Button
						@click="handleCreateProfile"
						type="primary"
						size="medium"
						wide
						:disabled="!isAllowedToContinue"
						:loading="isCreatingProfile"
					>
						Create
					</Button>
					<Button @click="handleCancel" type="secondary" size="medium" wide :disabled="isCreatingProfile">
						Cancel
					</Button>
				</Flex>
			</Flex>
		</Flex>
	</div>
</template>

<style module>
.wrapper {
	position: absolute;
	top: 50px;
	bottom: 0;
	left: 0;
	right: 0;

	overflow: hidden;
}

.card {
	height: 100%;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 32px;
}

.content {
	height: 100%;
}

.badges_wrapper {
	height: 36px;

	margin-top: 60px;
	margin-bottom: 70px;
}

.badges {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
}

.badge {
	max-width: 200px;
	height: 36px;

	overflow: hidden;

	background: linear-gradient(var(--txt-primary), var(--txt-secondary));
	border: 2px solid var(--gray-20);
	border-radius: 500px;

	padding: 0 16px 0 12px;

	&.dummy {
		background: var(--gray-5);
		border: 2px solid var(--gray-5);

		& .rect {
			background: var(--txt-support);
		}

		& svg {
			fill: var(--txt-support);
		}
	}

	& span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}

.rect {
	width: 80px;
	height: 4px;

	border-radius: 50px;
	background: var(--card-bg);
}
</style>
