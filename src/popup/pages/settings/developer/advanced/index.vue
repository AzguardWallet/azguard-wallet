<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"

/** Composables */
import { useToast } from "@/composables/toast"
import { useSettings } from "@/composables/settings.js"
const { openToast } = useToast()
const { settings, updateSettings } = useSettings()

/** Store */
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const router = useRouter()

const isDeveloperModeEnabled = ref(settings.value.developer.advancedMode)
watch(
	() => isDeveloperModeEnabled.value,
	async () => {
		updateSettings(
			"developer",
			"advancedMode",
			isDeveloperModeEnabled.value
		)
	}
)

const handleFullReset = () => {
	cacheStore.confirm.description =
		"You want to completely delete all local data - settings and so on"
	cacheStore.confirm.callback = async () => {
		await chrome.storage.local.clear()
		openToast({ label: "Local data deleted" })
		router.push("/popup/register")
	}

	popupStore.open("confirm")
}
</script>

<template>
	<Flex direction="column" gap="24" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Settings
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/developer">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Developer
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				Advanced
			</Text>
		</Flex>

		<Flex justify="between">
			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary">
					Developer Mode
				</Text>
				<Text size="12" weight="500" color="tertiary">
					Access to entity metadata, etc
				</Text>
			</Flex>

			<Toggle v-model="isDeveloperModeEnabled" />
		</Flex>

		<Flex v-if="isDeveloperModeEnabled" direction="column" gap="12">
			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary">
					Full storage reset
				</Text>
				<Text size="12" weight="500" height="140" color="tertiary">
					All local data will be deleted
				</Text>
			</Flex>

			<Button @click="handleFullReset" type="red" size="small">
				Full Reset
			</Button>
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
