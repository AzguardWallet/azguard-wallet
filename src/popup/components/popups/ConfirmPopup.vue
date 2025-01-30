<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store.ts"
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.confirm
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const handleConfirm = () => {
	cacheStore.confirm.callback()
	emit("onClose")
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.confirm">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex direction="column" align="center" gap="12">
						<Icon name="warning" size="18" color="orange" />
						<Text size="16" weight="600" color="primary">
							{{ cacheStore.confirm.title ? cacheStore.confirm.title : "Are you sure?" }}
						</Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center">
						{{ cacheStore.confirm.description }}
					</Text>
				</Flex>

				<Flex gap="12">
					<Button @click="emit('onClose')" wide type="secondary" size="medium"> Cancel </Button>

					<Button @click="handleConfirm" wide :type="cacheStore.confirm.confirm_color" size="medium">
						{{ cacheStore.confirm.confirm_text || "Confirm" }}
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
