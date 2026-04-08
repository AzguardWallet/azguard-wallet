<route lang="json">
{
	"meta": {
		"title": "Contacts",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Utils */
import { ContactServiceClient } from "@/wallet/services/contact/client"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { downloadFile, pickFile, sanitizeString, stringCompare } from "@/utils"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const contacts = ref([])
const sortedContacts = computed(() =>
	[...contacts.value].sort((a, b) => {
		const abbrPos = stringCompare(a.abbr, b.abbr)
		return abbrPos ? abbrPos : stringCompare(a.name, b.name)
	}),
)

const contactService = new ContactServiceClient()
contactService.onContactAdded.add(onContactAdded)
contactService.onContactUpdated.add(onContactUpdated)
contactService.onContactDeleted.add(onContactDeleted)
function onContactAdded(contact) {
	contacts.value.push(contact)
}
function onContactUpdated(contact) {
	const idx = contacts.value.findIndex((c) => c.id === contact.id)
	if (idx !== -1) {
		contacts.value[idx] = contact
	} else {
		contacts.value.push(contact)
	}
}
function onContactDeleted(contact) {
	contacts.value = contacts.value.filter((c) => c.id !== contact.id)
}

function handleClickContact(contact) {
	cacheStore.preselectedContactToSend = contact
	popupStore.open("send")
}
const handleCopyContactAddress = (contact) => {
	window.navigator.clipboard.writeText(contact.address)
	openToast({ label: "Address is copied", icon: "copy" })
}
function handleEditContact(contact) {
	cacheStore.contactToEditIdx = contact.id
	popupStore.open("edit_contact")
}
function handleDeleteContact(contact) {
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, delete contact"
	cacheStore.confirm.description = `Delete contact "${contact.name}"?`
	cacheStore.confirm.callback = async () => {
		await contactService.deleteContact(contact.id)
		openToast({ label: "Contact successfully deleted" })
	}

	popupStore.open("confirm")
}
async function handleExportContacts() {
	const data = contacts.value.map((contact) => ({
		name: contact.name,
		address: contact.address,
		color: contact.color,
	}))

	let filename = "contacts.json"

	const profileService = new ProfileServiceClient()
	profileService.connect()

	try {
		const profile = await profileService.getActiveProfile()

		if (profile.name) {
			filename = `${profile.name}_${filename}`
		}

		try {
			await downloadFile({
				data: JSON.stringify(data, null, 2),
				filename,
			})

			openToast({ label: "Contacts exported successfully", icon: "download" })
		} catch (err) {
			console.error("Export failed:", err.message || err)
			openToast({ label: "Failed to export contacts", icon: "warning" }, TOAST_DURATION.LONG)
		}
	} catch (err) {
		console.error(err)
	} finally {
		profileService.disconnect()
	}
}

async function handleImportContacts() {
	try {
		const file = await pickFile(".json", true)
		if (!file) return

		const data = await file.text()
		const importedContacts = JSON.parse(data)
			.map((c) => ({
				...c,
				name: sanitizeString(c.name, 20),
				address: sanitizeString(c.address, 66),
			}))
			.filter((c) => !!c.name && !!c.address)

		if (importedContacts?.length) {
			for (const _c of importedContacts) {
				cacheStore.importContacts.push(_c)
			}

			const importPromise = new Promise((resolve, reject) => {
				cacheStore.importPromise = { resolve, reject }
			})

			popupStore.open("import_contacts")

			try {
				const res = await importPromise
				if (res.length) {
					const contactsByAddress = new Map()
					const contactsByName = new Map()
					contacts.value.forEach((c) => {
						contactsByAddress.set(c.address, c)
						contactsByName.set(c.name, c)
					})

					const errors = []
					for (const _c of res) {
						const existingByAddress = contactsByAddress.get(_c.address)
						const existingByName = contactsByName.get(_c.name)
						try {
							if (existingByAddress) {
								await contactService.updateContact(existingByAddress.id, _c.name, _c.address)
							} else if (existingByName) {
								await contactService.updateContact(existingByName.id, _c.name, _c.address)
							} else {
								await contactService.addContact(_c.name, _c.address, _c.color)
							}
						} catch (err) {
							errors.push({
								name: _c.name,
								address: _c.address,
								operation: existingByAddress || existingByName ? "update" : "create",
								error: err,
							})
						}
					}

					if (errors.length) {
						for (const e of errors) {
							console.error(`Failed to ${e.operation} contact ${e.name} ${e.address}`, e.error)
						}

						openToast({ label: "Import ended with errors", icon: "warning" }, TOAST_DURATION.LONG)
					} else {
						openToast({ label: "Import competed successfully", icon: "info" })
					}
				} else {
					openToast({ label: "No contacts selected for import", icon: "info" })
				}
			} catch (err) {
				openToast({ label: "Contact import canceled", icon: "info" })
			}
		} else {
			openToast({ label: "No contacts found in file", icon: "info" })
		}
	} catch (err) {
		console.error("Error occurred during import", err.message || err.stack || err)

		openToast({ label: "Error occurred during import", icon: "warning" }, TOAST_DURATION.LONG)
	} finally {
		cacheStore.importContacts = []
		cacheStore.importPromise = null
	}
}

onMounted(async () => {
	contacts.value = await contactService.getContacts()
})
onBeforeUnmount(() => {
	contactService.disconnect()
})
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="8" :class="$style.section_wrapper">
			<Breadcrumbs hide-title />

			<PageHeader title="Contacts" icon="contacts" iconColor="blue" />
			
			<Flex direction="column" gap="16" :class="$style.section_wrapper">
				<Flex align="center" justify="end" gap="6" wide>
					<Tooltip position="end">
						<Icon
							@click="popupStore.open('new_contact')"
							name="plus-circle"
							size="16"
							color="tertiary"
							:class="$style.add_contact"
						/>

						<template #content>
							<Text size="12" color="secondary">Add new contact</Text>
						</template>
					</Tooltip>

					<Dropdown>
						<Button type="secondary" size="micro">
							<Icon name="dots" size="16" color="secondary" :class="$style.add_contact"/>
						</Button>

						<template #popup>
							<DropdownItem @click="handleExportContacts" :disabled="!contacts.length">
								<Flex align="center" gap="8">
									<Icon name="download-outline" size="14" color="secondary" />
									Export contacts
								</Flex>
							</DropdownItem>
							<DropdownItem @click="handleImportContacts">
								<Flex align="center" gap="8">
									<Icon name="upload-outline" size="14" color="secondary" />
									Import contacts
								</Flex>
							</DropdownItem>
						</template>
					</Dropdown>
				</Flex>
				
				<Flex v-if="sortedContacts.length" direction="column" gap="6" :class="$style.contacts_section">
					<Flex
						v-for="c in sortedContacts"
						@click="handleClickContact(c)"
						align="center"
						justify="between"
						:class="$style.contact"
						wide
					>
						<Flex align="center" gap="10" wide>
							<Flex align="center" justify="center" :class="$style.contact_avatar" :style="{ backgroundColor: `var(--${c.color})`}">
								<Text size="12" weight="600" color="primary">
									{{ c.abbr }}
								</Text>
							</Flex>
							<Flex direction="column" gap="4" wide>
								<Text size="14" weight="600" color="primary" :class="$style.title"> {{ c.name }} </Text>
								<Text size="12" weight="500" color="tertiary" :class="$style.description">
									{{ trimAddress(c.address) }}
								</Text>
							</Flex>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon
								@click.stop="handleCopyContactAddress(c)"
								name="copy"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
							<Icon
								@click.stop="handleEditContact(c)"
								name="edit"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
							<Icon
								@click.stop="handleDeleteContact(c)"
								name="close-circle"
								size="16"
								color="tertiary"
								:class="$style.delete_icon"
							/>
						</Flex>
					</Flex>

					<Button
						@click="popupStore.open('new_contact')"
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						wide
						:style="{marginTop: '8px'}"
					>
						New contact
					</Button>
				</Flex>

				<Flex v-else direction="column" align="center" justify="between" :class="$style.empty_section">
					<Flex direction="column" align="center" gap="12" :class="$style.empty_banner">
						<Icon name="contacts" size="20" color="tertiary" />

						<Flex direction="column" align="center" gap="6">
							<Text size="13" weight="600" color="secondary" align="center">
								There are no contacts
							</Text>
							<Text size="12" weight="500" height="140" color="tertiary" align="center">
								You can add the first one by simply clicking the button below
							</Text>
						</Flex>
					</Flex>

					<Button
						@click="popupStore.open('new_contact')"
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						wide
						:style="{marginTop: '8px'}"
					>
						New contact
					</Button>
				</Flex>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	height: 100%;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.add_contact {
	cursor: pointer;

	&:hover {
		fill: var(--txt-secondary);
	}
}

.section_wrapper {
	flex: 1;

	min-height: 0;
}

.contacts_section {
	flex: 1;

	padding-bottom: 100px;
	overflow: auto;
}

.contact_avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	flex-shrink: 0;
}

.new_contact_section {
	margin-bottom: 48px;
}

.contact {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.title {
	min-width: 100%;
	width: 0;

	line-height: 16px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.description {
	min-width: 100%;
	width: 0;

	line-height: 14px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.icon_btn {
	&:hover {
		fill: var(--txt-primary);
	}
}

.delete_icon {
	&:hover {
		fill: var(--red);
	}
}

.empty_section {
    flex: 1;

    margin-bottom: 50px;
}

.empty_banner {
	max-width: 250px;

	margin: 40px auto 0 auto;
}
</style>
