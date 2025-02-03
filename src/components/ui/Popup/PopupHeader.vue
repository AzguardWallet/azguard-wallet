<script setup>
const emit = defineEmits(["onClose"])
const props = defineProps({
	closable: {
		type: Boolean,
		default: false,
	},
})
</script>

<template>
	<Flex direction="column" gap="4" wide :class="$style.wrapper">
		<Flex align="center" justify="between">
			<slot name="title" />

			<Flex align="center" gap="8">
				<slot name="right" />

				<Icon
					v-if="closable"
					@click="emit('onClose')"
					name="close-circle-duotone"
					size="20"
					color="support"
					:class="$style.close_btn"
				/>
			</Flex>
		</Flex>

		<slot name="description" />
	</Flex>
</template>

<style module>
.wrapper {
	padding: 0 20px;
}

.close_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-secondary);
	}

	&:active {
		fill: var(--txt-primary);
	}
}
</style>
