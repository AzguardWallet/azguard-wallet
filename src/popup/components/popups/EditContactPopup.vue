<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { isValidHex } from "@/utils/string"

/** Services */
import { ContactServiceClient } from "@/wallet/services/contacts/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.edit_contact?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

let contactService = null
const contactToEdit = ref(null)
const contacts = ref([])

const nameTerm = ref("")
const contactAddressTerm = ref("")

const isStartedEditingName = ref(false)
const notAllowedContactNames = computed(() => contacts.value.map(c => c.name))
const isAlreadyExistName = computed(() => notAllowedContactNames.value.includes(nameTerm.value) && isStartedEditingName.value)
const isStartedEditingAddress = ref(false)
const notAllowedContactAddresses = computed(() => contacts.value.map(c => c.address))
const isAlreadyExistAddress = computed(() => notAllowedContactAddresses.value.includes(contactAddressTerm.value) && isStartedEditingAddress.value)
const isValidAddress = computed(() => isValidHex(contactAddressTerm.value))
const isAvailableToUpdateContact = computed(() => {
	if (!nameTerm.value.replace(/\s/g, '').length) return
	if (!isValidAddress.value) return
	if (isAlreadyExistName.value) return
	if (isAlreadyExistAddress.value) return
	
	return true
})

const isLoading = ref(false)
const processingError = ref({
	show: false,
	title: "",
	tooltip: "",
})

function handleFillFieldsWithDefaultValues() {
	nameTerm.value = contactToEdit.value?.name
	contactAddressTerm.value = contactToEdit.value?.address

	isStartedEditingName.value = false
	isStartedEditingAddress.value = false
}
const handleUpdateContact = async () => {
	if (!isAvailableToUpdateContact.value) return

	isLoading.value = true
	try {
		if (cacheStore.importContact) {
			cacheStore.importContact = {
				...contactToEdit.value,
				name: nameTerm.value.trim(),
				address: contactAddressTerm.value,
				updated: true,
			}
		} else {
			await contactService.updateContact(
				contactToEdit.value.id,
				{
					name: nameTerm.value.trim(),
					address: contactAddressTerm.value,
				}
			)

			openToast({ label: "Contact is updated" })
		}

		emit("onClose")
	} catch (err) {
		processingError.value = {
			show: true,
			title: "Failed to update contact.",
			tooltip: err,
		}

		openToast({ label: "Something went wrong", icon: "warning" })
	} finally {
		isLoading.value = false
	}
}

function onContactAdded(contact) {
	contacts.value.push(contact)
}
function onContactUpdated(contact) {
	const idx = contacts.value.findIndex(c => c.id === contact.id)
	if (idx !== -1) {
		if (cacheStore.contactToEditIdx && contact.id === contactToEdit.id) {
			nameTerm.value = contact.name
			contactAddressTerm.value = contact.address
			return
		}
		contacts.value[idx] = contact
	} else {
		contacts.value.push(contact)
	}
}
function onContactDeleted(contact) {
	contacts.value = contacts.value.filter(c => c.id !== contact.id)
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			cacheStore.contactToEditIdx = ""

			contactService.dispose()
			contactService = null
			contactToEdit.value = null
			contacts.value = []

			nameTerm.value = ""
			contactAddressTerm.value = ""
			isStartedEditingName.value = false
			isStartedEditingAddress.value = false

			document.removeEventListener("keydown", onKeydown)
		} else {
			contactService = new ContactServiceClient(
				undefined,
				undefined,
				onContactAdded,
				onContactUpdated,
				onContactDeleted,
			)

			contacts.value = await contactService.getContacts()
			contactToEdit.value = cacheStore.importContact ? cacheStore.importContact : contacts.value.find(c => c.id === cacheStore.contactToEditIdx)
			nameTerm.value = contactToEdit.value?.name
			contactAddressTerm.value = contactToEdit.value?.address

			document.addEventListener("keydown", onKeydown)
		}
	},
)

watch(
	() => [nameTerm.value, contactAddressTerm.value],
	() => {
		if (nameTerm.value?.trim() === contactToEdit.value?.name) {
			isStartedEditingName.value = false
		} else {
			isStartedEditingName.value = true
		}

		if (contactAddressTerm.value === contactToEdit.value?.address) {
			isStartedEditingAddress.value = false
		} else {
			isStartedEditingAddress.value = true
		}

		processingError.value.show = false
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleUpdateContact()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_contact?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit contact</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input
					label="Name"
					placeholder="New contact"
					autofocus
					:maxLength="64"
					v-model="nameTerm"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExistName" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Input
					label="Address"
					placeholder="0x15c4ac6afcffdf59aa8a1fb3317ff0c86aee3eb02f9e52c3612e1163d4701446"
					v-model="contactAddressTerm"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="!isValidAddress && contactAddressTerm" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid address </Text>
							</Flex>
							<Flex v-else-if="isAlreadyExistAddress && contactAddressTerm" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="10">
					<Transition name="fade">
						<Tooltip
							v-if="processingError.show"
							side="top"
							position="start"
							wide
							:disabled="!processingError.tooltip"
							:style="{ marginTop: '-12px' }"
						>
							<Flex align="center" wide>
								<Icon
									name="info"
									size="14"
									:color="processingError.type === 'warning' ? 'orange' : 'red'"
								/>

								<Text size="12" weight="600" color="secondary" :style="{ paddingLeft: '4px' }">
									{{ processingError.title }}
								</Text>
							</Flex>

							<template #content>
								<Text size="12" color="secondary">
									{{ processingError.tooltip }}
								</Text>
							</template>
						</Tooltip>
					</Transition>
					
					<Button
						@click="handleUpdateContact"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToUpdateContact || processingError.show || !(isStartedEditingName || isStartedEditingAddress)"
						:loading="isLoading"
						:class="processingError.show && $style.shake"
					>
						Update contact
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

.shake {
	animation: shake 0.5s ease;
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-2px);
	}
	50% {
		transform: translateX(2px);
	}
	75% {
		transform: translateX(-2px);
	}
}
</style>
