<script setup lang="ts">
/** Local Components */
import WalletPasswordContent from "./WalletPasswordContent.vue"

/** Utils */
import { managers, setSentinel } from "@/utils/core"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { sleep } from "@/wallet/utils"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useNotificationStore } from "@/stores/notification.store"
const appStore = useAppStore()
const notificationStore = useNotificationStore()

const emit = defineEmits(["onProfileCreated"])

const router = useRouter()

const walletPassword = ref<string>("")
const repeatedPassword = ref<string>("")

const isCreatingProfile = ref({
	password: false,
	passkey: false,
})
const isAllowedToContinue = computed(() => {
	if (!walletPassword.value.length || walletPassword.value.length < 8) {
		return false
	}

	if (!repeatedPassword.value || walletPassword.value !== repeatedPassword.value) {
		return false
	}

	return true
})
const handleCreateProfile = async (mode: "password" | "passkey" = "password") => {

	isCreatingProfile.value[mode] = true

	const profiles = await managers.profile.getProfiles()
	const name = `My Profile${profiles.length ? ` ${profiles.length}` : ''}`
	let profile
	try {
		profile = mode === "passkey"
			? await managers.profile.createPasskeyProfile(name)
			: await managers.profile.createProfile(name, walletPassword.value)
	} catch (e) {
		if (typeof e === "string" && !e?.toLowerCase().includes("user closed") && !e?.toLowerCase().includes("operation either timed out or was not allowed")) {
			let description
			let note
			if (mode === "passkey") {
				description = "An error occurred while creating the profile. This authenticator may not be supported or encountered an issue. Try again or use another one."
				note = "Windows Hello may not work correctly with some versions of Windows."
			} else {
				description = "An error occurred while creating the profile. Please try again."
			}

			notificationStore.create({
				type: "warning",
				payload: {
					title: "Profile Creation Failed",
					description,
					note,
					confirmText: "OK",
					onConfirm: () => {},
				},
			})

			console.error("Failed to create profile:", e);
		}
	} finally {
		isCreatingProfile.value[mode] = false
	}

	while (!appStore.isLogined) {
		await sleep(100) // wait for services initialization
	}

	managers.account = new AccountServiceClient()

	appStore.profile = profile
	appStore.accounts = await managers.account.getAccounts(appStore.profile.id, appStore.network.chainId, true)

	initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)

	await chrome.storage.local.set({
		"azguard:ui:activeAccount": appStore.account?.address,
	})
	
	await setSentinel()

	emit("onProfileCreated")

	router.push("/popup/general")

	appStore.showRegisterPopup = false
}

const handleCancel = () => {
	appStore.showRegisterPopup = false
}

const onKeydown = (e: KeyboardEvent) => {
	if (e.key === "Enter") {
		if (isAllowedToContinue.value && !isCreatingProfile.value.password && !isCreatingProfile.value.passkey) {
			handleCreateProfile()
		}
	}
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
				/>

				<Flex direction="column" gap="8">
					<Button
						@click="handleCreateProfile"
						type="primary"
						size="medium"
						wide
						:disabled="!isAllowedToContinue || isCreatingProfile.passkey"
						:loading="isCreatingProfile.password"
					>
						Create with Password
					</Button>
					<Button
						@click="handleCreateProfile('passkey')"
						type="primary"
						size="medium"
						wide
						:disabled="isCreatingProfile.passkey"
						:loading="isCreatingProfile.passkey"
					>
						Create with Passkey
					</Button>
					<Button @click="handleCancel" type="secondary" size="medium" wide :disabled="isCreatingProfile.passkey || isCreatingProfile.password">
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
