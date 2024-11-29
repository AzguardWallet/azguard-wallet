<script setup>
const props = defineProps({
	selectedSendType: {
		type: String,
	},
})

const amountTerm = ref()
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Flex justify="between" align="start" gap="12">
			<input
				v-model="amountTerm"
				placeholder="0.00"
				:class="$style.input_field"
			/>

			<Text size="14" weight="500" color="body"> $0.00 </Text>
		</Flex>

		<Flex align="center" gap="6">
			<Button
				@click="amountTerm = 2629"
				type="secondary"
				size="mini"
				round
			>
				<Icon
					:name="
						selectedSendType === 'private' ? 'key-square' : 'face'
					"
					size="16"
					:color="selectedSendType === 'private' ? 'green' : 'orange'"
				/>
				2,629 AZT
			</Button>
			<Button @click="amountTerm = 0" type="secondary" size="mini" round>
				Clear
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	background: var(--card-bg);
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);

	padding: 16px;
}

.input_field {
	width: 100%;

	font-size: 28px;
	font-weight: 600;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--txt-tertiary);
	}
}
</style>
