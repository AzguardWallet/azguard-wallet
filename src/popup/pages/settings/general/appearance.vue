<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const isDarkThemeEnabled = ref(appStore.theme === "dark")
watch(
	() => isDarkThemeEnabled.value,
	async () => {
		const theme = isDarkThemeEnabled.value ? "dark" : null

		const root = document.querySelector("html")
		root.setAttribute("theme", theme)

		appStore.theme = theme

		chrome.storage.local.set({ "azguard:ui:theme": theme })
	}
)
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings/general">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					General
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				Appearance
			</Text>
		</Flex>

		<Flex direction="column" gap="8">
			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						Dark Theme
					</Text>
					<Text size="13" weight="500" color="tertiary">
						Application Theme
					</Text>
				</Flex>

				<Toggle v-model="isDarkThemeEnabled" />
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
