<script setup lang="ts">
defineProps<{
	denied: boolean
	label: string
	disabled?: boolean
}>()

defineEmits<{
	toggle: []
}>()
</script>

<template>
	<Flex
		align="center"
		gap="6"
		:class="[$style.sub_row, disabled && $style.disabled]"
		@click.stop="$emit('toggle')"
	>
		<Flex align="center" gap="6" :class="denied && $style.denied_text">
			<Icon
				:name="denied ? 'circle' : 'check'"
				size="12"
				:color="denied ? 'tertiary' : 'green'"
			/>
			<Text size="13" color="secondary">{{ label }}</Text>
		</Flex>
		<slot />
		<Icon
			name="close"
			size="16"
			color="secondary"
			:class="[$style.deny_btn, denied && $style.deny_btn_hidden]"
		/>
	</Flex>
</template>

<style module>
.sub_row {
	cursor: pointer;
	border-radius: 6px;
	padding: 2px 4px;
	margin: -2px -4px;
	transition: background 0.15s ease;

	&:hover {
		background: var(--gray-5);
	}
}

.disabled {
	cursor: default;
	pointer-events: none;
}

.denied_text {
	opacity: 0.5;
}

.deny_btn {
	cursor: pointer;
	flex-shrink: 0;
	padding: 2px;
	border-radius: 4px;
	opacity: 0.5;
	transition: opacity 0.15s ease, background 0.15s ease;

	&:hover {
		opacity: 1;
		background: var(--gray-5);
	}
}

.deny_btn_hidden {
	opacity: 0;
	pointer-events: none;
}

</style>
