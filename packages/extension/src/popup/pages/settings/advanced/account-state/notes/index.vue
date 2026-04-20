<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

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

/** Long hex values (addresses, hashes, preimages) should wrap with
 *  overflow-wrap: anywhere instead of ellipsis-truncate — users need
 *  to glance-verify the head and tail, not just the head. Numeric
 *  values (amounts, block numbers) stay single-line. */
function isLongHex(value) {
	if (value === null || value === undefined) return false
	const s = String(value)
	return s.startsWith("0x") && s.length > 40
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
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<SubPageHeader title="Notes" :backTo="'/popup/settings/advanced/account-state'" />

		<Flex direction="column" gap="16" :class="$style.content">
			<Input
				v-if="notes.length"
				v-model="searchTerm"
				icon="search"
				placeholder="Search by type, contract or location"
				clearable
				@clear="searchTerm = ''"
			/>

			<LoadingState v-if="isFetchingNotes" label="FETCHING NOTES" />

			<Tooltip v-else-if="isErrorOccurred" wide>
				<Banner :action="{ name: 'Try again', callback: () => fetchNotes(true) }" variant="error" wide>
					Something went wrong
				</Banner>

				<template #content>
					{{ error }}
				</template>
			</Tooltip>
			
			<Flex v-else-if="filteredNotes.length" direction="column" gap="8">
				<div
					v-for="note in filteredNotes"
					@click="handleOpenNote(note)"
					:class="$style.card"
					:style="{ borderLeftColor: `var(--${getColorFromAddress(note.contract)})` }"
				>
					<div :class="$style.header">
						<span :class="$style.type">{{ note.type ?? 'Custom Note' }}</span>
						<span :class="$style.contract">{{ trimAddress(note.contract, 4, 4) }}</span>
					</div>

					<span v-if="note.location" :class="$style.location">{{ note.location }}</span>

					<div v-if="note.showingContent" :class="$style.kv_grid">
						<template v-for="[k, v] in Object.entries(note.showingContent)" :key="k">
							<span :class="$style.kv_key">{{ k }}</span>
							<span :class="[$style.kv_val, isLongHex(v) && $style.kv_val_wrap]">{{ v }}</span>
						</template>
					</div>

					<div v-else :class="$style.raw">
						<span v-for="(el, i) in note.rawContent" :key="i" :class="$style.raw_line">{{ el }}</span>
					</div>
				</div>
			</Flex>

			<div v-else-if="filteredNotes.length === 0 && searchTerm" :class="$style.no_results">
				NO MATCHES · TRY A DIFFERENT TERM
			</div>

			<div v-else :class="$style.empty">
				<span :class="$style.empty_headline">NO NOTES YET</span>
				<span :class="$style.empty_sub">Notes from your account contracts will appear here.</span>
			</div>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.card {
	display: flex;
	flex-direction: column;
	gap: 10px;

	cursor: pointer;

	/* Structural border on 3 sides; the left edge is a 4px colored
	   accent per-contract (getColorFromAddress inline style) so notes
	   from the same contract share a visual band. Keeps the chip
	   itself neutral — avoids collision with semantic red/orange. */
	border: 1px solid var(--nulo-border);
	border-left: 4px solid var(--nulo-border);

	padding: 12px 12px 12px 10px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);
		border-color: var(--nulo-outline);
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.type {
	flex: 1;
	min-width: 0;

	font-family: var(--font-headline);
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.contract {
	flex-shrink: 0;

	padding: 3px 6px;

	background: var(--nulo-surface-low);
	border: 1px solid var(--nulo-border);

	font-family: var(--font-mono);
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: var(--nulo-secondary);
}

.location {
	font-family: var(--font-mono);
	font-size: 12px;
	color: var(--nulo-outline);
	line-height: 1.4;
	word-break: break-all;
}

.kv_grid {
	display: grid;
	grid-template-columns: minmax(90px, 120px) 1fr;
	gap: 4px 12px;
	align-items: baseline;
}

.kv_key {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-outline);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.kv_val {
	font-family: var(--font-mono);
	font-size: 12px;
	color: var(--txt-primary);

	min-width: 0;

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/** Long hex values get a 2-line wrap so users can glance-verify head + tail. */
.kv_val_wrap {
	white-space: normal;
	overflow-wrap: anywhere;
	line-height: 1.4;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
}

.raw {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.raw_line {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
	overflow-wrap: anywhere;
	line-height: 1.4;

	&:not(:first-child) {
		padding-top: 4px;
		border-top: 1px solid var(--nulo-border);
	}
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	padding: 32px 16px;
	border: 1px dashed var(--nulo-border);

	text-align: center;
}

.empty_headline {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.empty_sub {
	width: 100%;

	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
	overflow-wrap: break-word;
}

.no_results {
	padding: 24px 16px;
	text-align: center;

	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	color: var(--nulo-outline);
}
</style>
