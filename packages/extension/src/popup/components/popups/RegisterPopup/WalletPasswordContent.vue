<script setup>
const emit = defineEmits(["onPasswordInput", "onRepeatedPasswordInput", "onProfileTypeChange"])

const password = defineModel("password")
const repeatedPassword = defineModel("repeatedPassword")

const inputElement = useTemplateRef("inputElement")

const isPasswordType = ref(true)

const maxPasswordLength = 128
const maxLengthReached = ref(false)
const handleMaxLengthReached = (event) => {
	maxLengthReached.value = event
}

const profilType = ref("password")
function swithProfileType() {
	if (profilType.value === "password") {
		profilType.value = "passkey"
	} else {
		profilType.value = "password"
	}

	emit("onProfileTypeChange", profilType.value)
}

onMounted(() => {
	inputElement.value.inputEl.focus()
})
</script>

<template>
	<Flex direction="column" gap="24">
		<Flex direction="column" gap="8">
			<Flex gap="8" :class="$style.type_toggle">
				<button
					@click="profilType !== 'password' && swithProfileType()"
					type="button"
					:class="[$style.type_pill, profilType === 'password' && $style.type_pill_active]"
				>
					Password
				</button>
				<button
					@click="profilType !== 'passkey' && swithProfileType()"
					type="button"
					:class="[$style.type_pill, profilType === 'passkey' && $style.type_pill_active]"
				>
					Passkey
				</button>
			</Flex>

			<Text size="13" weight="500" color="tertiary"> Will be used to protect your wallet </Text>
		</Flex>

		<Flex v-if="profilType === 'password'" direction="column" gap="24">
			<Flex direction="column" gap="12">
				<Input
					ref="inputElement"
					v-model="password"
					@input="emit('onPasswordInput')"
					@maxLengthReached="handleMaxLengthReached"
					:type="isPasswordType ? 'password' : 'text'"
					:maxLength="maxPasswordLength"
					placeholder="Strong password"
				>
					<template #suffix>
						<MaterialIcon
							@click="isPasswordType = !isPasswordType"
							:name="isPasswordType ? 'visibility' : 'visibility_off'"
							:size="18"
							color="secondary"
							style="cursor: pointer"
						/>
					</template>
				</Input>

				<Input
					v-model="repeatedPassword"
					:type="isPasswordType ? 'password' : 'text'"
					:maxLength="maxPasswordLength"
					@input="emit('onRepeatedPasswordInput')"
					placeholder="Repeat password"
				/>
			</Flex>

			<Flex v-if="maxLengthReached" align="center" gap="6">
				<Transition name="fade">
					<Tooltip position="start">
						<Flex align="center" gap="6">
							<Icon name="warning" size="12" color="yellow" />
							<Text size="12" color="primary"> Maximum length reached </Text>
						</Flex>

						<template #content>
							{{ `Maximum password length is ${maxPasswordLength} characters` }}
						</template>
					</Tooltip>
				</Transition>
			</Flex>

			<Flex align="center" gap="6">
				<Text size="12" weight="600" color="tertiary">
					{{
						(password.length < 8 && "At least 8 characters") ||
						(password !== repeatedPassword && "Passwords don't match") ||
						(password.length > 24 && "Long enough. Don't forget it.") ||
						"Strong password"
					}}
				</Text>
			</Flex>
		</Flex>

		<Flex v-else align="center">
			<Text size="13" height="120" color="tertiary">
				No password required! Your new profile will be linked to your passkey, so you can sign in securely and effortlessly — no memorizing, no typing, just one tap.
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.type_toggle {
	/* grid keeps both pills equal width regardless of label length */
	display: grid;
	grid-template-columns: 1fr 1fr;
}

.type_pill {
	display: flex;
	align-items: center;
	justify-content: center;

	height: 44px;
	padding: 0 16px;

	background: transparent;
	border: 2px solid var(--nulo-outline);
	cursor: pointer;

	font-family: var(--font-headline);
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--txt-primary);

	transition: all 0.15s var(--bezier);

	&:hover:not(.type_pill_active) {
		background: var(--nulo-surface-low);
	}
}

.type_pill_active {
	background: var(--nulo-accent);
	color: #0a0908;
	border-color: var(--nulo-accent);
}

.password_input {
	font-size: 16px;
	font-weight: 600;
	line-height: 1;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--txt-support);
	}
}
</style>
