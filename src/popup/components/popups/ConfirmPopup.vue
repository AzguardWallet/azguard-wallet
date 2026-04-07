<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.confirm?.order
})

const confirmationInputEl = useTemplateRef("confirmationInputEl")
const confirmationTerm = ref()
const isPasskeyConfirmed = ref(false)
const isConfirmed = computed(() => {
	return (
		cacheStore.confirm.confirmation_text &&
		cacheStore.confirm.confirmation_text === confirmationTerm.value
	) ||
	(
		cacheStore.confirm.passkeyConfirmation &&
		isPasskeyConfirmed.value
	) ||
	(
		!cacheStore.confirm.confirmation_text &&
		!cacheStore.confirm.passkeyConfirmation
	)
})

async function handlePasskeyConfirmation() {
	if (isPasskeyConfirmed.value) {
		openToast({ label: "The operation is already confirmed", icon: "info" })
		return
	}

	try {
		const confirmation = await managers.profile.confirmProfileOperation(appStore.profile.id);
		if (confirmation) {
			isPasskeyConfirmed.value = true
			confirmationTerm.value = cacheStore.confirm.confirmation_text || ""
		}
	} catch (error) {
		
	}	
}

const handleConfirm = () => {
	cacheStore.confirm.callback()
	emit("onClose")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			confirmationTerm.value = null
			isPasskeyConfirmed.value = false

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
			<Flex direction="column" gap="32" :class="$style.wrapper" wide>
				<Flex align="center" direction="column" gap="12">
					<Flex direction="column" align="center" gap="12">
						<Icon name="warning" size="18" color="orange" />
						<Text size="16" weight="600" color="primary">
							{{ cacheStore.confirm.title ? cacheStore.confirm.title : "Are you sure?" }}
						</Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" :class="$style.description">
						{{ cacheStore.confirm.description }}
					</Text>
				</Flex>

				<Flex v-if="cacheStore.confirm.confirmation_text || cacheStore.confirm.passkeyConfirmation" align="center" justify="between" gap="8" wide>
					<Input
						ref="confirmationInputEl"
						v-model="confirmationTerm"
						:placeholder="cacheStore.confirm.confirmation_text"
						wide
					/>

					<Button v-if="cacheStore.confirm.passkeyConfirmation" @click="handlePasskeyConfirmation" type="tertiary" size="medium">
						<Icon name="passkey" size="24" :color="isPasskeyConfirmed ? 'green' : 'tertiary'" />
					</Button>
				</Flex>

				<Flex gap="12">
					<Button @click="emit('onClose')" wide type="secondary" size="medium"> Cancel </Button>

					<Button
						@click="handleConfirm"
						wide
						:type="cacheStore.confirm.confirm_color"
						:disabled="!isConfirmed"
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

.description {
	max-width: 100%;
	word-wrap: break-word;
}
</style>
