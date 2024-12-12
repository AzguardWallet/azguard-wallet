<script setup>
/** Utils */
import { managers } from "@/utils/core.js"

const props = defineProps({
	show: {
		type: Boolean,
		default: false,
	},
	displaceIdx: {
		type: Number,
	},
})
const emit = defineEmits(["onClose"])

watch(
	() => props.show,
	() => {
		if (props.show) {
			const _ = managers.profile?.refreshSession()
		}
	}
)
</script>

<template>
	<Transition name="opacity">
		<div
			v-if="show"
			:class="$style.dark_bg"
			:style="{ zIndex: (displaceIdx + 1) * 100 * 4 }"
		/>
	</Transition>
	<Transition name="slide" appear>
		<template v-if="show">
			<teleport to="#popup">
				<Flex
					direction="column"
					:class="$style.wrapper"
					:style="{ zIndex: (displaceIdx + 1) * 100 * 5 }"
				>
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
}

.close_area {
	flex: 1;

	width: 100%;
	min-height: 40px;
}

.dark_bg {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;

	background: var(--op-50);
}
</style>
