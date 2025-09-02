<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { isValidHex } from "@/utils/string"

/** Services */
import { ContactServiceClient } from "@/wallet/services/contact/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_contact?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const contactService = new ContactServiceClient()
contactService.onContactAdded.add(onContactAdded)
contactService.onContactUpdated.add(onContactUpdated)
contactService.onContactDeleted.add(onContactDeleted)

function onContactAdded(contact) {
	contacts.value.push(contact)
}
function onContactUpdated(contact) {
	const idx = contacts.value.findIndex(c => c.id === contact.id)
	if (idx !== -1) {
		contacts.value[idx] = contact
	} else {
		contacts.value.push(contact)
	}
}
function onContactDeleted(contact) {
	contacts.value = contacts.value.filter(c => c.id !== contact.id)
}

const contacts = ref([])

const nameTerm = ref("")
const contactAddressTerm = ref("")

const notAllowedContactNames = computed(() => contacts.value.map(c => c.name))
const isAlreadyExistName = computed(() => notAllowedContactNames.value.includes(nameTerm.value))
const notAllowedContactAddresses = computed(() => contacts.value.map(c => c.address))
const isAlreadyExistAddress = computed(() => notAllowedContactAddresses.value.includes(contactAddressTerm.value))
const isValidAddress = computed(() => isValidHex(contactAddressTerm.value))
const isAvailableToAddContact = computed(() => {
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

const handleAddContact = async () => {
	if (!isAvailableToAddContact.value) return

	isLoading.value = true
	try {
		await contactService.addContact(
			nameTerm.value.trim(),
			contactAddressTerm.value,
		)

		emit("onClose")
		openToast({ label: "Contact is added" })
	} catch (err) {
		processingError.value = {
			show: true,
			title: "Failed to add contact.",
			tooltip: err,
		}

		openToast({ label: "Something went wrong", icon: "warning" })
	} finally {
		isLoading.value = false
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			contactService.disconnect()

			contacts.value = []
			nameTerm.value = ""
			contactAddressTerm.value = ""

			document.removeEventListener("keydown", onKeydown)
		} else {
			contactService.connect()
			contacts.value = await contactService.getContacts()

			document.addEventListener("keydown", onKeydown)
		}
	},
)

watch(
	() => [nameTerm.value, contactAddressTerm.value],
	() => {
		processingError.value.show = false
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleAddContact()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_contact?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New contact</Text>
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
						@click="handleAddContact"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToAddContact || processingError.show"
						:loading="isLoading"
						:class="processingError.show && $style.shake"
					>
						Add contact
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
