<script setup>
const model = defineModel()

const types = ["Ecdsa", "Schnorr", "SingleKey"]
</script>

<template>
	<Flex direction="column" gap="24">
		<Flex direction="column" gap="8">
			<Text size="20" weight="600" color="primary"> Account Type </Text>
			<Text size="13" weight="500" color="tertiary">
				Something important
			</Text>
		</Flex>

		<Flex align="center" justify="between" gap="6">
			<Flex
				v-for="type in types"
				@click="model = type"
				align="center"
				justify="center"
				gap="6"
				:class="[$style.item, type == model && $style.selected]"
			>
				<Icon
					v-if="type === model"
					name="check-circle"
					size="12"
					color="white"
				/>
				<Text
					size="14"
					weight="600"
					:color="type === model ? 'white' : 'primary'"
					>{{ type }}</Text
				>
			</Flex>
		</Flex>

		<Text
			size="12"
			weight="500"
			color="support"
			height="140"
			style="width: 250px"
		>
			This description should describe these types and be limited to 2
			lines
		</Text>
	</Flex>
</template>

<style module>
.item {
	height: 30px;

	border-radius: 8px;
	box-shadow: inset 0 0 0 2px var(--gray-5);
	cursor: pointer;

	padding: 0 16px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 2px var(--gray-10);
	}

	&:active {
		background: var(--gray-5);
	}

	&.selected {
		background: var(--green);
	}
}
</style>
