<script setup>
/** Utils */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

if (appStore.isLogined) router.push("/popup/general")

const inputElement = useTemplateRef("inputElement")
const password = ref("")

const handleUnlockWallet = async () => {
	if (!password.value.length) return

	try {
		const test = await managers.profile.signInProfile(
			appStore.profile.id,
			password.value
		)

		if (!test) return

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
	inputElement.value.focus()

	document.addEventListener("keydown", onKeydown)
})
</script>

<template>
	<Flex direction="column" jusitfy="between" :class="$style.wrapper">
		<Flex direction="column" gap="32" style="flex: 1">
			<Icon name="key-square" size="24" color="tertiary" />

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

			<input
				ref="inputElement"
				v-model="password"
				placeholder="Enter password"
				type="password"
				autocomplete="false"
				autofocus="true"
				spellcheck="false"
				:class="[$style.password_input]"
			/>

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

		<Flex direction="column" gap="16">
			<Or />
			<Button wide type="secondary" size="medium">
				Forget Password?
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: #fff;
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
