<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import JsonViewer from "@/components/ui/JsonViewer/JsonViewer.vue"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

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
	return popupStore.len - popupStore.popups.note
})

const note = computed(() => cacheStore.activeNote)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.note">
		<PopupCard :displaceIdx>
			<Flex wide align="center" direction="column" gap="24" :class="$style.wrapper">
				<JsonViewer :data="note" />

				<Button @click="emit('onClose')" type="secondary" size="medium" wide>Close</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
