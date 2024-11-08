<script setup>
const props = defineProps({
	show: {
		type: Boolean,
		default: false,
	},
})
const emit = defineEmits(["onClose"])
</script>

<template>
	<Transition name="slide" appear>
		<template v-if="show">
			<teleport to="#popup">
				<Flex direction="column" :class="$style.wrapper">
					<div @click="emit('onClose')" :class="$style.close_area" />

					<slot />
				</Flex>
			</teleport>
		</template>
	</Transition>
</template>

<style module>
.wrapper {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;

	z-index: 5;
}

.close_area {
	flex: 1;

	width: 100%;
	min-height: 60px;
}
</style>
