<script setup>
/** Utils */
import { AccountServiceClient } from "@/wallet/services/account/client"
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

if (appStore.isLogined) router.push("/popup/general")

const inputElement = useTemplateRef("inputElement")
const password = ref("")
const isPasswordType = ref(true)

const handleUnlockWallet = async () => {
	if (!password.value.length) return

	try {
		const activeProfile = await managers.profile.unlockProfile(
			appStore.profile.id,
			password.value
		)

		if (!activeProfile) return

		appStore.profile = activeProfile
		managers.account = new AccountServiceClient(
			appStore.profile,
			appStore.network
		)

		appStore.isLogined = true
		router.push("/popup/general")
	} catch (err) {
		console.log(err)
	}
}

const onKeydown = (e) => {
	if (e.code === "Enter") handleUnlockWallet()
}

onMounted(() => {
	inputElement.value.inputEl.focus()

	document.addEventListener("keydown", onKeydown)
})
</script>

<template>
	<Flex direction="column" jusitfy="between" :class="$style.wrapper">
		<Flex direction="column" gap="32" style="flex: 1">
			<Icon name="lock" size="24" color="tertiary" />

			<Flex direction="column" gap="12">
				<Text
					size="24"
					weight="600"
					color="primary"
					style="line-height: 16px"
				>
					Wallet is locked
				</Text>
				<Text size="14" weight="500" color="tertiary" height="140">
					Enter your password to continue
				</Text>
			</Flex>

			<Input
				ref="inputElement"
				v-model="password"
				:type="isPasswordType ? 'password' : 'text'"
				placeholder="Enter password"
				label="Password"
			>
				<template #suffix>
					<Icon
						@click="isPasswordType = !isPasswordType"
						:name="isPasswordType ? 'password' : 'text'"
						size="16"
						color="blue"
						style="cursor: pointer"
					/>
				</template>
			</Input>

			<Button
				@click="handleUnlockWallet"
				wide
				type="primary"
				size="medium"
				:disabled="password.length < 8"
			>
				<Text color="white">Unlock Wallet</Text>
			</Button>
		</Flex>

		<Text
			size="12"
			weight="500"
			color="tertiary"
			height="140"
			align="center"
		>
			If you forget your password, you can
			<Text @click="popupStore.open('reset')" color="blue">reset</Text>
			your wallet. This action cannot be undone.
		</Text>
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
</style>
