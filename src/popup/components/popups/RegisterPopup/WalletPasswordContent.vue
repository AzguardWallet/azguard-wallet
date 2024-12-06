<script setup>
const emit = defineEmits(["onPasswordInput", "onRepeatedPasswordInput"])

const password = defineModel("password")
const repeatedPassword = defineModel("repeatedPassword")

const inputElement = useTemplateRef("inputElement")

const isPasswordType = ref(true)

onMounted(() => {
	inputElement.value.inputEl.focus()
})
</script>

<template>
	<Flex direction="column" gap="24">
		<Flex direction="column" gap="8">
			<Text size="20" weight="600" color="primary"> Password </Text>
			<Text size="13" weight="500" color="tertiary"> Will be used to protect your wallet </Text>
		</Flex>

		<Flex direction="column" gap="12">
			<Input
				ref="inputElement"
				v-model="password"
				@input="emit('onPasswordInput')"
				:type="isPasswordType ? 'password' : 'text'"
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
				@input="emit('onRepeatedPasswordInput')"
				placeholder="Repeat password"
			/>
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
</template>

<style module>
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
