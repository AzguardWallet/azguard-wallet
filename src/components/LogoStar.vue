<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const isShifted = computed(() => {
	return !appStore._isHomeScreenOpened || appStore.showRegisterPopup
})
</script>

<template>
	<div :class="[$style.wrapper, isShifted && $style.shift]">
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
	</div>
</template>

<style module>
.wrapper {
	position: absolute;
	top: 0;
	left: 50%;
	transform: translateX(-50%);
	z-index: -1;

	transition: all 1s var(--bezier);

	margin-top: 90px;

	&.shift {
		transform: translateX(-50%) translateY(-320%);

		& .logo_icon {
			fill: rgba(0, 0, 0, 30%);
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
	transform: rotate(0);
	transform-origin: center;

	opacity: 0.03;

	animation: rotation 100s linear infinite;

	transition: all 1s var(--bezier);
}

@keyframes rotation {
	0% {
		transform: rotate(0);
	}

	50% {
		transform: rotate(360deg);
	}

	100% {
		transform: rotate(0);
	}
}

.logo_icon {
	fill: rgba(0, 0, 0, 50%);

	z-index: 2;

	transition: all 1s var(--bezier);
}
</style>
