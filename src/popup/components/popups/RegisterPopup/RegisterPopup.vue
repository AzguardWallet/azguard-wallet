<script setup lang="ts">
/** Local Components */
import WalletPasswordContent from "./WalletPasswordContent.vue"
// import WalletTypeContent from "./WalletTypeContent.vue"

/** Utils */
import { managers } from "@/utils/core"
import {
	AccountServiceClient,
	AccountType,
} from "@/wallet/services/account/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const walletPassword = ref<string>("")
const repeatedPassword = ref<string>("")

const handleCreateProfile = async () => {
	if (!isAllowedToContinue.value) return

	const profile = await managers.profile.createProfile(
		"My Wallet",
		walletPassword.value
	)

	managers.account = new AccountServiceClient(profile, appStore.network)

	const account = await managers.account.createAccount(
		AccountType.Azguard_v0,
		"Vault"
	)

	appStore.profile = profile
	appStore.account = account
	appStore.accounts = await managers.account.getAccounts(true)

	appStore.isLogined = true

	await chrome.storage.local.set({
		"azguard:ui:activeAccount": account.address,
	})
	await chrome.storage.local.set({
		[`azguard:ui:profileCreatedAt@${profile.id}`]: new Date().getTime(),
	})

	router.push("/popup/general")
}

const stepIdx = ref<number>(0)
watch(
	() => stepIdx.value,
	() => {
		if (stepIdx.value !== 1) return
		handleCreateProfile()
	}
)
const handleNextStep = () => {
	if (!isAllowedToContinue.value) return

	stepIdx.value += 1
}
const handlePrevStep = () => {
	if (!stepIdx.value) {
		appStore.showRegisterPopup = false
		return
	}

	stepIdx.value -= 1
}

const onKeydown = (e: KeyboardEvent) => {
	if (e.key === "Enter") handleNextStep()
}

onMounted(() => {
	document.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
	document.removeEventListener("keydown", onKeydown)
})

const isAllowedToContinue = computed(() => {
	if (
		stepIdx.value === 0 &&
		(!walletPassword.value.length || walletPassword.value.length < 8)
	) {
		return false
	}

	if (
		stepIdx.value === 0 &&
		(!repeatedPassword.value ||
			walletPassword.value !== repeatedPassword.value)
	) {
		return false
	}

	return true
})
</script>

<template>
	<div :class="$style.wrapper">
		<Flex direction="column" :class="$style.card">
			<div :class="$style.badges_wrapper">
				<Flex align="center" gap="16" :class="$style.badges">
					<Flex
						align="center"
						gap="8"
						:class="[$style.badge, $style.dummy]"
					>
						<Icon name="password" size="16" color="white" />
						<div :class="$style.rect" />
					</Flex>
					<Flex align="center" gap="8" :class="[$style.badge]">
						<Icon name="vault" size="20" color="inverse" />
						<div
							v-if="!walletPassword.length"
							:class="$style.rect"
						/>
						<Flex v-else align="center" gap="2">
							<Icon
								v-for="_ in Math.min(8, walletPassword.length)"
								name="asterisk"
								size="10"
								color="inverse"
							/>
						</Flex>
					</Flex>
					<Flex
						align="center"
						gap="8"
						:class="[$style.badge, $style.dummy]"
					>
						<Icon name="user" size="16" color="white" />
						<div :class="$style.rect" />
					</Flex>
				</Flex>
			</div>

			<Flex direction="column" justify="between" :class="$style.content">
				<Transition name="fade" mode="out-in">
					<WalletPasswordContent
						v-if="stepIdx === 0"
						v-model:password="walletPassword"
						v-model:repeatedPassword="repeatedPassword"
					/>
					<!-- <WalletTypeContent
						v-else-if="stepIdx === 1"
						v-model="walletType"
					/> -->
				</Transition>

				<Flex direction="column" gap="8">
					<Button
						@click="handleCreateProfile"
						type="primary"
						size="medium"
						wide
						:disabled="!isAllowedToContinue"
					>
						<Text color="inverse">Create</Text>
					</Button>
					<Button
						@click="handlePrevStep"
						type="secondary"
						size="medium"
						wide
					>
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
	box-shadow: 0 0 0 1px var(--gray-5);

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
