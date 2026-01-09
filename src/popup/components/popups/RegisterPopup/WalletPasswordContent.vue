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
			<Flex @click="swithProfileType" align="end" gap="12">
				<Text
					size="20"
					:class="[$style.profile_type, profilType === 'password' && $style.profile_type_active]"
				>
					Password
				</Text>

				<Text size="20" color="tertiary">|</Text>

				<Text
					size="20"
					:class="[$style.profile_type, profilType === 'passkey' && $style.profile_type_active]"
				>
					Passkey
				</Text>
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
						<Icon
							@click="isPasswordType = !isPasswordType"
							:name="isPasswordType ? 'password' : 'text'"
							size="16"
							color="blue"
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
				<Icon name="password" size="12" color="tertiary" />
				<Text size="12" weight="600" color="tertiary">
					{{
						(password.length < 8 && "At least 8 characters") ||
						(password !== repeatedPassword && "Not repeated") ||
						(password.length > 24 && "I hope you remember it") ||
						"Looks.. strong?"
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
.profile_type {
	cursor: pointer;
	color: var(--txt-tertiary);
	font-weight: 500;
	transition: all 0.2s ease-in-out;
}

.profile_type_active {
	color: var(--txt-primary);
	font-weight: 600;
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
