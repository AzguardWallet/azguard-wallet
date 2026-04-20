<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store.ts"
import { useCacheStore } from "@/stores/cache.store.ts"
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.data_viewer?.order
})

const data = computed(() => cacheStore.viewerData)

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			cacheStore.viewerData = null
		}
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.data_viewer?.order">
		<PopupCard :displaceIdx>
			<Flex wide align="center" direction="column" gap="24" :class="$style.wrapper">
				<JsonViewer :data="data" />

				<Button @click="emit('onClose')" type="primary_outline" size="medium" wide>Close</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
