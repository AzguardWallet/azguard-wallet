<script setup lang="ts">
/** Local Components */
import WalletNameContent from "./WalletNameContent.vue"
import WalletPasswordContent from "./WalletPasswordContent.vue"
import WalletTypeContent from "./WalletTypeContent.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const walletName = ref<string>("")
const walletPassword = ref<string>("")
const walletType = ref<string>("Ecdsa")

const steps = ["name", "password", "type"]
const stepIdx = ref<number>(0)
const handleNextStep = () => {
	if (!isAllowedToContinue.value) return

	if (stepIdx.value + 1 === steps.length) {
		appStore._wallet.name = walletName.value
		appStore._wallet.created_at = new Date().getTime()

		router.push("/popup/general")
	}

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
		(!walletName.value.length || walletName.value.length < 2)
	) {
		return false
	}

	if (
		stepIdx.value === 1 &&
		(!walletPassword.value.length || walletPassword.value.length < 8)
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
						<Icon name="user" size="16" color="white" />
						<div :class="$style.rect" />
					</Flex>
					<Flex align="center" gap="8" :class="[$style.badge]">
						<Icon name="user" size="16" color="white" />
						<div v-if="!walletName.length" :class="$style.rect" />
						<Text
							v-else-if="!walletPassword.length"
							size="14"
							weight="600"
							color="white"
						>
							{{ walletName }}
						</Text>
						<Flex v-else align="center" gap="2">
							<Icon
								v-for="_ in Math.min(8, walletPassword.length)"
								name="asterisk"
								size="10"
								color="white"
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
					<WalletNameContent
						v-if="stepIdx === 0"
						v-model="walletName"
					/>
					<WalletPasswordContent
						v-else-if="stepIdx === 1"
						v-model="walletPassword"
					/>
					<WalletTypeContent
						v-else-if="stepIdx === 2"
						v-model="walletType"
					/>
				</Transition>

				<Flex direction="column" gap="8">
					<Button
						@click="handleNextStep"
						type="primary"
						size="medium"
						wide
						:disabled="!isAllowedToContinue"
					>
						<Text color="white">Continue</Text>
					</Button>
					<Button
						@click="handlePrevStep"
						type="tertiary"
						size="medium"
						wide
					>
						Back
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

	background: #fff;
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

	margin-top: 80px;
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

	background: linear-gradient(rgba(0, 0, 0, 80%), rgba(0, 0, 0, 60%));
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
	background: #fff;
}
</style>
