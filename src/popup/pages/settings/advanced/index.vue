<route lang="json">
{
	"meta": {
		"title": "Advanced Settings",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast"
import { useSettings } from "@/composables/settings.js"
const { openToast } = useToast()
const { settings, updateSettings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const isDeveloperModeEnabled = ref(settings.value?.developer?.advancedMode)
const indicateWalletActivity = ref(settings.value?.developer?.indicateWalletActivity)

const handleFullReset = () => {
	cacheStore.confirm.description = "You want to completely delete all local data - settings and so on"
	cacheStore.confirm.callback = async () => {
		try {
			await managers.profile.deleteProfile(appStore.profile.id)
		} catch (error) {
			// TODO: handle errors
		}
		await chrome.storage.local.clear()
		await chrome.storage.session.clear()
		chrome.runtime.reload()
	}

	popupStore.open("confirm")
}

watch(
	() => isDeveloperModeEnabled.value,
	async () => {
		updateSettings("developer", "advancedMode", isDeveloperModeEnabled.value)
		if (!indicateWalletActivity.value) {
			indicateWalletActivity.value = true
		}
	},
)
watch(
	() => indicateWalletActivity.value,
	async () => {
		updateSettings("developer", "indicateWalletActivity", indicateWalletActivity.value)
	},
)
</script>

<template>
	<Flex direction="column" gap="32" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex justify="between">
			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary"> Developer Mode </Text>
				<Text size="12" weight="500" color="tertiary"> Access to entity metadata, etc </Text>
			</Flex>

			<Toggle v-model="isDeveloperModeEnabled" />
		</Flex>

		<Flex
			v-if="isDeveloperModeEnabled"
			direction="column"
			gap="24"
		>
			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Indicate failures </Text>
					<Text size="12" weight="500" color="tertiary"> Highlight errors and warnings in header </Text>
				</Flex>

				<Toggle v-model="indicateWalletActivity" />
			</Flex>

			<!-- <Flex direction="column" gap="12">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Full storage reset </Text>
					<Text size="12" weight="500" height="140" color="tertiary"> All local data will be deleted </Text>
				</Flex>

				<Button @click="handleFullReset" type="red" size="small" disabled> Full Reset </Button>
			</Flex> -->
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
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
