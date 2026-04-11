<script setup>
const model = defineModel()

const inputElement = useTemplateRef("inputElement")

onMounted(() => {
	inputElement.value.focus()
})
</script>

<template>
	<Flex direction="column" gap="24">
		<Flex direction="column" gap="8">
			<Text size="20" weight="600" color="primary"> Wallet name </Text>
			<Text size="13" weight="500" color="tertiary">
				Come up with a short name for wallet
			</Text>
		</Flex>

		<input
			ref="inputElement"
			v-model="model"
			placeholder="E.g. My Vault"
			type="text"
			autocomplete="false"
			autofocus="true"
			spellcheck="false"
			:class="$style.name_input"
		/>

		<Flex v-if="model.length > 2" align="center" gap="6">
			<Icon name="check-circle" size="12" color="green" />
			<Text
				size="12"
				weight="600"
				:color="model.length > 20 ? 'tertiary' : 'green'"
			>
				Looks good<Text v-if="model.length > 20"
					>, but it's probably too long</Text
				>
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.name_input {
	font-size: 16px;
	font-weight: 600;
	line-height: 1;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--txt-support);
	}
}
</style>
