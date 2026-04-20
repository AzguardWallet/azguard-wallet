<script setup>
import { isBackgroundConnected } from "@/utils/core.js"
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const message = computed(() =>
	appStore.isLogined ? { title: "RECONNECTING", sub: "Service worker dropped" } : { title: "INITIALIZING", sub: "Initial connection" },
)
</script>

<template>
	<Teleport to="body">
		<div v-if="!isBackgroundConnected" :class="$style.wrapper" data-testid="global-loader">
			<div :class="$style.card">
				<Spinner size="24" color="--txt-primary" />

				<span :class="$style.title">{{ message.title }}</span>
				<span :class="$style.sub">{{ message.sub }}</span>
			</div>
		</div>
	</Teleport>
</template>

<style module>
.wrapper {
	position: fixed;
	inset: 0;

	display: flex;
	justify-content: center;
	align-items: center;

	background-color: rgba(10, 9, 8, 0.85);
	z-index: 9999;
}

.card {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;

	width: 80%;
	max-width: 320px;
	padding: 28px 20px;

	background: var(--app-bg);
	border: 1px dashed var(--nulo-border);

	text-align: center;
}

.title {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.sub {
	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
}
</style>
