<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const route = useRoute()

const isShifted = computed(() => {
	return !appStore._isHomeScreenOpened || appStore.showRegisterPopup
})

/** Hide the decorative backdrop on the lock screen — auth already carries
 *  its own wordmark + toggles, another glyph overhead would be redundant. */
const isVisible = computed(() => route.name !== "popup-auth")
</script>

<template>
	<Flex
		v-if="isVisible"
		align="center"
		justify="center"
		:class="[$style.wrapper, isShifted && $style.shift]"
	>
		<div :class="$style.bg">
			<Icon
				name="star"
				:size="isShifted ? 216 : 360"
				:class="$style.star_icon"
			/>
			<Icon
				name="logo"
				:size="isShifted ? 24 : 40"
				:class="$style.logo_icon"
			/>
		</div>
	</Flex>
</template>

<style module>
.wrapper {
	position: absolute;
	top: 0;
	left: 50%;
	width: 360px;
	height: 360px;
	z-index: -1;
	overflow: hidden;

	transition: all 1s var(--bezier);

	transform: translateY(-80px) translateX(-50%);

	&.shift {
		transform: translateY(-154px) translateX(-50%);

		& .logo_icon {
			fill: rgba(255, 255, 255, 0.3);
		}
	}
}

.bg {
	position: relative;

	display: flex;
	align-items: center;
	justify-content: center;
}

.star_icon {
	position: absolute;
	transform-origin: center;

	fill: var(--nulo-surface-low);

	transition: all 1s var(--bezier);
}

.logo_icon {
	fill: rgba(255, 255, 255, 0.5);

	z-index: 2;

	transition: all 1s var(--bezier);
}
</style>
