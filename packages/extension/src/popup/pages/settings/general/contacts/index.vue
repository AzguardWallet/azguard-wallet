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
// from what's actually stored, with a seq guard against stale in-flight fetches.
let syncSeq = 0
async function syncContacts() {
	const mySeq = ++syncSeq
	const result = await contactService.getContacts()
	if (mySeq !== syncSeq) return
	contacts.value = result
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

		<Flex direction="column" gap="12" :class="$style.content">
			<div :class="$style.section_label">
				<span>Contacts</span>
				<span :class="$style.section_count">{{ sortedContacts.length }}</span>
			</div>

			<ItemsContainer v-if="sortedContacts.length">
				<div
					v-for="c in sortedContacts"
					:key="c.id"
					role="button"
					tabindex="0"
					@click="handleClickContact(c)"
					@keydown.enter="handleClickContact(c)"
					:class="$style.row"
				>
					<Flex align="center" gap="12" wide>
						<div :class="$style.avatar" :style="{ backgroundColor: `var(--${c.color})` }">
							<span :class="$style.avatar_text">{{ c.abbr }}</span>
						</div>

						<Flex direction="column" gap="2" wide :class="$style.row_text">
							<span :class="$style.row_name">{{ c.name }}</span>
							<span :class="$style.row_address">{{ trimAddress(c.address) }}</span>
						</Flex>

						<Flex align="center" gap="8" :class="$style.actions">
							<span
								role="button"
								tabindex="0"
								@click.stop="handleCopyContactAddress(c)"
								@keydown.enter.stop="handleCopyContactAddress(c)"
								:class="$style.action"
								aria-label="Copy address"
							>
								<Icon name="copy" size="14" color="tertiary" />
							</span>
							<span
								role="button"
								tabindex="0"
								data-testid="contact-edit"
								@click.stop="handleEditContact(c)"
								@keydown.enter.stop="handleEditContact(c)"
								:class="$style.action"
								aria-label="Edit contact"
							>
								<Icon name="edit" size="14" color="tertiary" />
							</span>
							<span
								role="button"
								tabindex="0"
								data-testid="contact-delete"
								@click.stop="handleDeleteContact(c)"
								@keydown.enter.stop="handleDeleteContact(c)"
								:class="[$style.action, $style.action_danger]"
								aria-label="Delete contact"
							>
								<Icon name="close-circle" size="14" color="tertiary" />
							</span>
						</Flex>
					</Flex>
				</div>
			</ItemsContainer>

			<div v-else :class="$style.empty">
				<div :class="$style.empty_label">No contacts yet</div>
				<div :class="$style.empty_hint">Add someone you send to often</div>
			</div>

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

.section_label {
	display: flex;
	align-items: baseline;
	gap: 10px;

	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.section_count {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}

.row {
	position: relative;
	padding: 12px 16px;
	cursor: pointer;
	background: transparent;
	outline: none;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}

	&:active {
		background: var(--nulo-surface-highest);
	}

	&:focus-visible {
		background: var(--nulo-surface-high);
	}

	&::after {
		position: absolute;
		bottom: 0;
		left: 16px;
		right: 16px;
		display: block;
		height: 1px;

		background: rgba(74, 70, 63, 0.3);

		content: " ";
	}

	&:last-child::after {
		display: none;
	}
}

.avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;

	width: 24px;
	height: 24px;
}

.avatar_text {
	font-family: var(--font-mono);
	font-size: 10px;
	font-weight: 700;
	color: var(--txt-inverse);
	line-height: 1;
}

.row_text {
	min-width: 0;
}

.row_name {
	font-family: var(--font-body);
	font-size: 14px;
	font-weight: 600;
	color: var(--txt-primary);
	line-height: 20px;
	letter-spacing: 0.01em;

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.row_address {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
	line-height: 16px;

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.actions {
	flex-shrink: 0;
}

.action {
	display: inline-flex;
	align-items: center;
	justify-content: center;

	width: 20px;
	height: 20px;

	cursor: pointer;
	outline: none;

	transition: all 0.2s var(--bezier);

	&:hover svg {
		fill: var(--txt-primary);
	}

	&:focus-visible {
		background: var(--nulo-surface-high);
	}
}

.action_danger {
	&:hover svg {
		fill: var(--red);
	}
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;

	padding: 40px 16px;

	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);
}

.empty_label {
	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.empty_hint {
	font-family: var(--font-body);
	font-size: 12px;
	color: var(--nulo-outline);
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
</style>
