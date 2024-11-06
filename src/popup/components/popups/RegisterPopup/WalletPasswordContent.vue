<script setup>
const model = defineModel()

const inputElement = useTemplateRef("inputElement")

const isPasswordType = ref(true)

onMounted(() => {
	inputElement.value.focus()
})
</script>

<template>
	<Flex direction="column" gap="24">
		<Flex direction="column" gap="8">
			<Text size="20" weight="600" color="primary"> Password </Text>
			<Text size="13" weight="500" color="tertiary">
				Will be used to protect your wallet
			</Text>
		</Flex>

		<input
			ref="inputElement"
			v-model="model"
			placeholder="Password"
			:type="isPasswordType ? 'password' : 'text'"
			autocomplete="false"
			autofocus="true"
			spellcheck="false"
			:class="$style.password_input"
		/>

		<Flex align="center" justify="between">
			<Flex align="center" gap="6">
				<Icon name="password" size="12" color="tertiary" />
				<Text size="12" weight="600" color="tertiary">
					{{
						model.length < 8
							? "At least 8 characters"
							: "Looks... strong? "
					}}
				</Text>
			</Flex>

			<Flex
				@click="isPasswordType = !isPasswordType"
				align="center"
				gap="6"
				style="cursor: pointer"
			>
				<Icon name="password-preview" size="12" color="blue" />
				<Text size="12" weight="600" color="blue">Preview</Text>
			</Flex>
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
