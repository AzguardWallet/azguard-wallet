<route lang="json">
{
	"meta": {
		"title": "Notes",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../../components/Navigation.vue"

/** Utils */
import { NoteServiceClient } from "@/wallet/services/note/client"
import { stringCompare } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const notes = ref([])
const filteredNotes = computed(() => {
	const term = searchTerm.value.trim().toLowerCase()
	if (!term) return notes.value

	return notes.value.filter(
		(n) =>
			n.contract.toLowerCase().includes(term) ||
			(n.type ? n.type : "custom note").toLowerCase().includes(term) ||
			n.location?.toLowerCase().includes(term),
	)
})
const noteService = new NoteServiceClient()
const isFetchingNotes = ref(false)

const error = ref()
const isErrorOccurred = computed(() => !!error.value)

const searchTerm = ref("")

const fetchNotes = async (isRefetching) => {
	if (isRefetching) openToast({ label: "Fetching notes again", icon: "zap" })
	isFetchingNotes.value = true

	try {
		notes.value = await noteService.getNotes(appStore.network.id, appStore.account.address)
		for (const n of notes.value) n.showingContent = parseNoteContent(n)
		notes.value.sort((a, b) => {
			const contractCompare = stringCompare(a.contract, b.contract)

			return contractCompare ? contractCompare : stringCompare(a.location, b.location)
		})
	} catch (err) {
		error.value = err
	} finally {
		isFetchingNotes.value = false
	}
}

function parseNoteContent(note) {
	if (!note.content) return null

	const allowed = ["value", "amount", "token_id", "expiry_block_number", "remaining_txs", "points"]

	const filtered = Object.fromEntries(Object.entries(note.content).filter(([key]) => allowed.includes(key)))

	return Object.keys(filtered).length > 0 ? filtered : note.content
}

const handleOpenNote = (note) => {
	cacheStore.viewerData = note
	popupStore.open("data_viewer")
}

watch(
	() => appStore.account,
	() => {
		fetchNotes()
	},
)

onMounted(async () => {
	if (appStore.network && appStore.isLogined) fetchNotes()
})

onBeforeUnmount(() => {
	noteService.disconnect()
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="16">
			<Input
				v-if="filteredNotes.length"
				v-model="searchTerm"
				icon="search"
				placeholder="Search by type, contract or location"
				clearable
				@clear="searchTerm = ''"
			/>

			<Banner v-if="isFetchingNotes" isLoading> Fetching notes </Banner>

			<Tooltip v-else-if="isErrorOccurred" wide>
				<Banner :action="{ name: 'Try again', callback: () => fetchNotes(true) }" variant="error" wide>
					Something went wrong
				</Banner>

				<template #content>
					{{ error }}
				</template>
			</Tooltip>
			
			<Flex v-else-if="filteredNotes.length" direction="column" gap="8">
				<Flex v-for="note in filteredNotes" @click="handleOpenNote(note)" direction="column" gap="6" :class="$style.card">
					<Flex align="center" justify="between" gap="12" wide>
						<Text size="14" weight="600" color="primary" :class="$style.row"> {{ note.type ?? 'Custom Note' }} </Text>

						<Flex
							align="center"
							gap="6"
							:class="$style.badge"
							:style="{ background: `var(--${getColorFromAddress(note.contract)})` }"
						>
							<AddressDisplay size="11" weight="600" :address="note.contract" :formatter="(addr) => trimAddress(addr, 4, 4)" />
							<!-- <Text size="11" weight="600"> {{ trimAddress(note.contract, 4, 4) }} </Text> -->
						</Flex>
					</Flex>

					<Text v-if="note.location" size="13" weight="600" color="tertiary" :class="$style.row"> {{ note.location }} </Text>

					<div :class="$style.divider" />

					<Flex v-if="!!note.showingContent" v-for="[k, v] in Object.entries(note.showingContent)" align="center" gap="4" wide :class="$style.content">
						<Text size="13" color="tertiary"> {{ `${k}:` }} </Text>
						<Text size="13" color="tertiary" weight="600"> {{ v }} </Text>
					</Flex>

					<Flex v-else v-for="el in note.rawContent" align="center" gap="4" wide :class="$style.content">
						<Text size="13" color="tertiary" weight="600"> {{ el }} </Text>
					</Flex>
				</Flex>
			</Flex>

			<Flex v-else-if="filteredNotes.length === 0 && searchTerm" align="center" justify="center" gap="8" :style="{marginTop: '24px'}">
				<Text size="13" weight="600" color="tertiary"> No notes found </Text>
			</Flex>

			<Banner v-else> So far, it's empty </Banner>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding: 16px 24px 96px 24px;
}

.card {
	border-radius: 0;
	cursor: pointer;
	border: 1px solid var(--nulo-border);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);
		box-shadow: inset 0 0 0 1px var(--nulo-outline), 0 1px 2px rgba(10, 9, 8, 0.5);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}

.badge {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);
}

.divider {
	width: 100%;
	height: 1px;

	margin: 4px 0;
	
	background: linear-gradient(
		to right,
		transparent 0%,
		var(--nulo-outline) 20%,
		var(--nulo-outline) 80%,
		transparent 100%
	);
}

.row {
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.content {
	max-width: 100%;

	& span:last-child {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
}
</style>
