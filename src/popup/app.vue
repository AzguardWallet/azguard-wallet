<script setup lang="ts">
/** Components */
import LogoStar from "@/components/LogoStar.vue"
import SendPopup from "./components/popups/SendPopup.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const route = useRoute()

watch(
	() => route.name,
	() => {
		appStore._isHomeScreenOpened = route.name === "popup-register"
	}
)
</script>

<template>
	<LogoStar />

	<Flex wide direction="column" :class="$style.wrapper">
		<!--  refactor  -->
		<Transition name="slide">
			<SendPopup v-if="appStore.showSendPopup" />
		</Transition>

		<Flex
			v-if="!appStore._isHomeScreenOpened"
			align="center"
			justify="between"
			:class="$style.header"
		>
			<Flex align="center" justify="center" :class="$style.button">
				<Icon name="globe" size="18" color="secondary" />
			</Flex>
			<Flex align="center" justify="center" :class="$style.button">
				<Icon name="dots" size="18" color="secondary" />
			</Flex>
		</Flex>

		<RouterView v-slot="{ Component }">
			<Transition name="navigation" mode="out-in">
				<component :is="Component"></component>
			</Transition>
		</RouterView>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	overflow: hidden;
}

.header {
	margin: 12px 20px;
}

.button {
	width: 24px;
	height: 24px;

	border-radius: 50px;
	background: var(--gray-10);
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-15);
	}

	&:active {
		background: var(--gray-20);
	}
}
</style>
