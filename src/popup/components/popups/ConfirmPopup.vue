<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.confirm?.order
})

const confirmationInputEl = useTemplateRef("confirmationInputEl")
const confirmationTerm = ref()
const isConfirmationTextValid = computed(() => cacheStore.confirm.confirmation_text === confirmationTerm.value)

const handleConfirm = () => {
	cacheStore.confirm.callback()
	emit("onClose")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			confirmationTerm.value = null

			cacheStore.confirm = {}
		} else {
			if (cacheStore.confirm.confirmation_text) {
				await nextTick()
				confirmationInputEl.value.inputEl.focus()
			}
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.confirm?.order">
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

				<Input
					v-if="cacheStore.confirm.confirmation_text"
					ref="confirmationInputEl"
					v-model="confirmationTerm"
					:placeholder="cacheStore.confirm.confirmation_text"
				/>

				<Flex gap="12">
					<Button @click="emit('onClose')" wide type="secondary" size="medium"> Cancel </Button>

					<Button
						@click="handleConfirm"
						wide
						:type="cacheStore.confirm.confirm_color"
						:disabled="cacheStore.confirm.confirmation_text && !isConfirmationTextValid"
						size="medium"
					>
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
