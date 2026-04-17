<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"

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

// Re-sync from storage on any contact event — guarantees the UI can't drift
// from what's actually stored, regardless of event-push timing edge cases.
async function syncContacts() {
	contacts.value = await contactService.getContacts()
}
contactService.onContactAdded.add(syncContacts)
contactService.onContactUpdated.add(syncContacts)
contactService.onContactDeleted.add(syncContacts)

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
	await syncContacts()
})

// Whenever the New Contact popup closes, re-sync — belt + suspenders on top of
// the event-based sync, since the popup also disconnects its own client mid-flow.
watch(
	() => !!popupStore.popups.new_contact,
	(isOpen, wasOpen) => {
		if (wasOpen && !isOpen) syncContacts()
	},
)
onBeforeUnmount(() => {
	contactService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Contacts" leadingIcon="people" :backTo="'/popup/settings/general'">
			<template #trailing>
				<Dropdown>
					<button type="button" :class="$style.icon_btn" aria-label="Contact actions">
						<MaterialIcon name="more_vert" :size="18" color="secondary" />
					</button>

					<template #popup>
						<DropdownItem @click="handleImportContacts">
							<Flex align="center" gap="8">
								<Icon name="upload-outline" size="14" color="secondary" />
								Import contacts
							</Flex>
						</DropdownItem>
						<DropdownItem @click="handleExportContacts" :disabled="!contacts.length">
							<Flex align="center" gap="8">
								<Icon name="download-outline" size="14" color="secondary" />
								Export contacts
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</template>
		</SubPageHeader>

		<Flex direction="column" gap="16" :class="$style.content">
			<Text size="13" weight="600" color="primary">
				Contacts&nbsp;<Text color="tertiary">{{ sortedContacts.length }}</Text>
			</Text>

			<ItemsContainer v-if="sortedContacts.length">
				<SettingItem
					v-for="c in sortedContacts"
					:key="c.id"
					@click="handleClickContact(c)"
					:title="c.name"
					:description="trimAddress(c.address)"
				>
					<template #icon>
						<Flex align="center" justify="center" :class="$style.avatar" :style="{ backgroundColor: `var(--${c.color})` }">
							<Text size="10" weight="700" color="inverse">{{ c.abbr }}</Text>
						</Flex>
					</template>

					<template #right>
						<Flex align="center" gap="8">
							<Icon
								@click.stop="handleCopyContactAddress(c)"
								name="copy"
								size="14"
								color="tertiary"
								:class="$style.action_icon"
							/>
							<div data-testid="contact-edit" @click.stop="handleEditContact(c)" :class="$style.action_wrapper">
								<Icon name="edit" size="14" color="tertiary" :class="$style.action_icon" />
							</div>
							<div data-testid="contact-delete" @click.stop="handleDeleteContact(c)" :class="$style.action_wrapper">
								<Icon name="close-circle" size="14" color="tertiary" :class="$style.delete_icon" />
							</div>
						</Flex>
					</template>
				</SettingItem>
			</ItemsContainer>

			<Banner v-else>No contacts yet</Banner>

			<Button
				@click="popupStore.open('new_contact')"
				wide
				type="secondary"
				size="medium"
				leftIcon="plus-circle"
				leftIconColor="primary"
			>
				<Text size="13">New contact</Text>
			</Button>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	scrollbar-gutter: stable;
	background: var(--app-bg);
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.avatar {
	width: 20px;
	height: 20px;
	flex-shrink: 0;
}

.icon_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 32px;
	height: 32px;

	background: transparent;
	border: none;
	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: rgba(248, 241, 231, 0.08);
	}
}

.action_wrapper {
	display: inline-flex;
	cursor: pointer;
}

.action_icon {
	cursor: pointer;
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}

.delete_icon {
	cursor: pointer;
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--red);
	}
}
</style>
