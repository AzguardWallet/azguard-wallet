<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.edit_fpc?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

let fpcService = null
const fpcs = ref([])
const fpcToEdit = ref(null)
const nameTerm = ref("")
const notAllowedFpcNames = computed(() => fpcs.value.map(n => n.name))

const isStartedEditing = ref(false)
const handleFillFieldsWithDefaultValues = () => {
	nameTerm.value = fpcToEdit.value?.name

	isStartedEditing.value = false
}

const isAlreadyExist = computed(() => notAllowedFpcNames.value.includes(nameTerm.value) && isStartedEditing.value)
const isAvailableToUpdateFpc = computed(() => {
	if (!nameTerm.value?.length) return
	if (isAlreadyExist.value) return

	return true
})

const isFpcUpdateInProgress = ref(false)
const handleUpdateFpc = async () => {
	if (!isAvailableToUpdateFpc.value) return

	isFpcUpdateInProgress.value = true
	try {
		await fpcService.updateFpc(cacheStore.fpcToEditIdx, nameTerm.value)
		emit("onClose")

		openToast({ label: "FPC is updated" })
	} catch (err) {
		
	} finally {
		isFpcUpdateInProgress.value = false
	}
}
const onFpcAdded = (fpc) => {
	fpcs.value.push(fpc)
}
const onFpcUpdated = (fpc) => {
	const idx = fpcs.value.findIndex(f => f.id === fpc.id)

	if (idx === -1) return
	fpcs.value[idx] = fpc
}
const onFpcDeleted = (fpc) => {
	if (fpc.id === fpcToEdit.value.id) {
		emit("onClose")
		openToast({ label: "FPC was deleted" })
		return
	}
	fpcs.value = fpcs.value.filter(f => f.id !== fpc.id)
}
watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			fpcService.dispose()
			fpcService = null
			fpcToEdit.value = null
			fpcs.value = []
			nameTerm.value = ""
			isStartedEditing.value = false
		} else {
			fpcService = new FpcServiceClient(undefined, undefined, onFpcAdded, onFpcUpdated, onFpcDeleted)
			fpcToEdit.value = await fpcService.getFpc(cacheStore.fpcToEditIdx)
			if (!fpcToEdit.value) {
				emit("onClose")
				return
			}
			nameTerm.value = fpcToEdit.value.name
			fpcs.value = await fpcService.getFpcs(appStore.network.chainId)

			document.addEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleUpdateFpc()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_fpc?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit FPC</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						size="large"
						:title="fpcToEdit?.name || fpcToEdit?.address"
						description="Selected FPC for editing"
						icon="fpc"
						raw
					/>
				</ItemsContainer>

				<Input
					label="New name"
					placeholder="My FPC"
					v-model="nameTerm"
					autofocus
					@input="isStartedEditing = true"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="12">
					<Button
						@click="handleUpdateFpc"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToUpdateFpc || !isStartedEditing"
						:loading="isFpcUpdateInProgress"
					>
						Update
					</Button>
					<Button @click="handleFillFieldsWithDefaultValues" wide type="secondary" size="medium">
						Reset changes
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
