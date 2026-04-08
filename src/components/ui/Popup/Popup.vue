<script setup>
/** Vendor */
import * as focusTrap from "focus-trap"

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

let trap
const popupEl = useTemplateRef("popupEl")

watch(
	() => props.show,
	async () => {
		if (props.show) {
			const _ = managers.profile?.refreshSession()

			await nextTick()
			trap = focusTrap.createFocusTrap(popupEl.value?.wrapper, {
				initialFocus: false,
				allowOutsideClick: true,
				fallbackFocus: popupEl.value?.wrapper,
			})
			trap.activate()
		} else {
			await nextTick()
			if (trap?.active) {
				trap.deactivate()
			}
		}
	},
	{ flush: "post" },
)
</script>

<template>
	<Transition name="slideopacity">
		<div v-if="show" :class="$style.dark_bg" :style="{ zIndex: (displaceIdx + 1) * 100 * 4 }" />
	</Transition>
	<Transition name="slide" appear>
		<template v-if="show">
			<teleport to="#popup">
				<Flex
					ref="popupEl"
					direction="column"
					:class="$style.wrapper"
					:style="{ zIndex: (displaceIdx + 1) * 100 * 5 }"
				>
					<div @click="emit('onClose')" :class="$style.close_area" />

					<!-- Need to refactor !!! -->
					<button style="position: absolute; opacity: 0; pointer-events: none;" aria-hidden="true" tabindex="0">
						focus trap dummy
					</button>

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
