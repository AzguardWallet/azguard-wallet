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
	return (
		popupStore.popups.length -
		popupStore.popups.findIndex((p) => p === "confirm")
	)
})

const emit = defineEmits(["onClose"])
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard :displaceIdx="displaceIdx">
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="warning" size="18" color="primary" />
						<Text size="16" weight="600" color="primary">
							{{
								cacheStore.confirm.title
									? cacheStore.confirm.title
									: "Are you sure?"
							}}
						</Text>
					</Flex>

					<Text
						size="14"
						weight="500"
						color="body"
						height="140"
						align="center"
					>
						{{ cacheStore.confirm.description }}
					</Text>
				</Flex>

				<Flex gap="16">
					<Button
						@click="emit('onClose')"
						wide
						type="secondary"
						size="medium"
					>
						Cancel
					</Button>

					<Button
						@click="cacheStore.confirm.callback()"
						wide
						type="primary"
						size="medium"
					>
						<Text color="inverse">Confirm</Text>
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
