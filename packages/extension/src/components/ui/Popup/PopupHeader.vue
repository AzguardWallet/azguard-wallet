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

			<Flex align="center" gap="16">
				<slot name="right" />

				<button
					v-if="closable"
					@click="emit('onClose')"
					type="button"
					aria-label="Close"
					:class="$style.close_btn"
				>
					<MaterialIcon name="close" :size="20" color="secondary" />
				</button>
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
	display: flex;
	align-items: center;
	justify-content: center;

	width: 28px;
	height: 28px;

	background: transparent;
	border: none;
	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}
}
</style>
