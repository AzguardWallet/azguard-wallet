<script setup lang="ts">
/** Components */
import WalletPasswordContent from "./WalletPasswordContent.vue"

/** Utils */
import { managers, setSentinel } from "@/utils/core"
import { capitalize } from "@/utils/string"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { sleep } from "@/wallet/utils"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { useNotificationStore } from "@/stores/notification.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const notificationStore = useNotificationStore()

const configService = new ConfigServiceClient()

const emit = defineEmits(["onProfileCreated"])

const router = useRouter()

const walletPassword = ref<string>("")
const repeatedPassword = ref<string>("")
const profilType = ref<string>("password")

const isCreatingProfile = ref<boolean>(false)
const isAllowedToContinue = computed(() => {
	if (profilType.value === "passkey") return true

	if (!walletPassword.value.length || walletPassword.value.length < 8) {
		return false
	}

	if (!repeatedPassword.value || walletPassword.value !== repeatedPassword.value) {
		return false
	}

	return true
})

function handleProfileTypeChange(type: string) {
	profilType.value = type
}

// Apply privacy settings after profile creation
async function applyPrivacySettings() {
	// Clear promo flow flag if set
	if (cacheStore.privacySettings !== null) {
		cacheStore.privacySettings = null
	}
	// Note: Config defaults are already "open" (stealth OFF, all ON, links enabled)
	// If user came from promo, settings were saved there
	// If user ignored promo, config defaults apply automatically

	// Mark that user has seen the stealth promo (prevents showing again)
	await configService.setValue("hasSeenStealthPromo", true)
}

const handleCreateProfile = async () => {
	isCreatingProfile.value = true

	const profiles = await managers.profile.getProfiles()
	const name = `My Profile${profiles.length ? ` ${profiles.length}` : ""}`
	let profile
	try {
		profile =
			profilType.value === "passkey"
				? await managers.profile.createPasskeyProfile(name)
				: await managers.profile.createProfile(name, walletPassword.value)
	} catch (e) {
		if (
			typeof e === "string" &&
			!e?.toLowerCase().includes("user closed") &&
			!e?.toLowerCase().includes("operation either timed out or was not allowed")
		) {
			let description
			let note
			if (profilType.value === "passkey") {
				description =
					"An error occurred while creating the profile. This authenticator may not be supported or encountered an issue. Try again or use another one."
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

			console.error("Failed to create profile:", e)
		}
	} finally {
		isCreatingProfile.value = false
	}

	while (!appStore.isLogined) {
		await sleep(100) // wait for services initialization
	}

	managers.account = new AccountServiceClient()

	appStore.profile = profile
	appStore.accounts = await managers.account.getAccounts(appStore.profile.id, appStore.network.chainId, true)

	initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)

	await chrome.storage.local.set({
		"nulo:ui:activeAccount": appStore.account?.address,
	})

	await setSentinel()

	// Apply privacy settings (from promo flow or defaults)
	await applyPrivacySettings()

	emit("onProfileCreated")

	router.push("/popup/general")

	appStore.showRegisterPopup = false
}

const handleCancel = () => {
	appStore.showRegisterPopup = false
}

const onKeydown = (e: KeyboardEvent) => {
	if (e.key === "Enter") {
		if (isAllowedToContinue.value && !isCreatingProfile.value) {
			handleCreateProfile()
		}
	}
}

onMounted(() => {
	document.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
	document.removeEventListener("keydown", onKeydown)
	configService.disconnect()
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
					@onProfileTypeChange="handleProfileTypeChange"
					v-model:password="walletPassword"
					v-model:repeatedPassword="repeatedPassword"
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
						Create with {{ capitalize(profilType) }}
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
