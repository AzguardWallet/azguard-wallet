<script setup>
/** Vendor */
import { onMounted, ref, watch, withDirectives } from "vue"
import { EditorView } from "codemirror"
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state"
import {
	keymap,
	highlightActiveLine,
	Decoration,
} from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { searchKeymap } from "@codemirror/search"

/** Utils */
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { capitalize } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Services */
import { createLoggerTheme } from "./creator.js"

const props = defineProps({
	// logs: {
	// 	type: Array,
	// 	required: true,
	// },
})

const editorRef = ref(null)
let view = null

let loggerService = null
let profileService = null
const logs = ref([])

function getLogLevelName(level) {
	return level.toLowerCase() === "log"
		? "INFO"
		: level
}

const defLevels = ["INFO", "DEBUG", "WARN", "ERROR"]
const selectedLevels = ref([...defLevels])
const filteredLogs = computed(() =>
	logs.value.filter(log => selectedLevels.value.includes(getLogLevelName(log.level).toUpperCase()))
)
const isDownloaded = ref(false)

const AUTO_SCROLL_TIMEOUT_MS = 30_000
const SCROLL_DISABLE_THRESHOLD = 20
const MAX_LOGS_COUNT = 2_000
const MAX_LOGS_DIFF = 100

const shouldAutoScroll = ref(true)
const showScrollBtn = ref(false)
let scrollTimeout = null

const handleSelectlevel = (level) => {
	if (selectedLevels.value.includes(level)) {
		selectedLevels.value = selectedLevels.value.filter(l => l !== level)
	} else {
		selectedLevels.value = [...selectedLevels.value, level]
	}
}

const onLogAdded = (log) => {
	logs.value.push(log)

	if (logs.value.length > MAX_LOGS_COUNT + MAX_LOGS_DIFF) {
		logs.value.splice(0, MAX_LOGS_DIFF)
	}

	if (!selectedLevels.value.includes(getLogLevelName(log.level).toUpperCase())) {
		return
	}

	if (view) {
		const doc = view.state.doc

		if (filteredLogs.value.length > MAX_LOGS_COUNT + MAX_LOGS_DIFF) {
			view.dispatch({
				changes: {
					from: doc.line(1).from,
					to: doc.line(MAX_LOGS_DIFF).to + 1,
					insert: ""
				}
			})
		}

		const newLine = `${formatSingleLog(log)}\n`
		view.dispatch({
			changes: {
				from: doc.length,
				insert: newLine
			}
		})

		if (shouldAutoScroll.value) {
			scrollToBottom()
		} else {
			showScrollBtn.value = true
		}
	}
}

function enableAutoScroll() {
	clearTimeout(scrollTimeout)
	shouldAutoScroll.value = true
}
function disableAutoScroll() {
	clearTimeout(scrollTimeout)
	shouldAutoScroll.value = false

	scrollTimeout = setTimeout(() => {
		shouldAutoScroll.value = true
	}, AUTO_SCROLL_TIMEOUT_MS)
}
function updateShouldAutoScroll() {
	const el = view?.scrollDOM
	if (!el) return

	const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_DISABLE_THRESHOLD

	if (isAtBottom) {
		showScrollBtn.value = false
		enableAutoScroll()
	} else {
		showScrollBtn.value = true
		disableAutoScroll()
	}
}

function scrollToBottom() {
	if (!view) return

	const lastLine = view.state.doc.line(view.state.doc.lines)
	const linePos = lastLine.from

	view.dispatch({
		effects: EditorView.scrollIntoView(linePos, {
			y: "end",
		})
	})

	showScrollBtn.value = false
}

function formatSingleLog(log) {
	const time = new Date(log.ts).toLocaleTimeString()
	const level = log.level.toUpperCase()
	const args = (log.args || []).map(String).join(" ")

	return `[${time}] [${log.origin}]${log.source ? ` [${log.source}]` : ""} ${getLogLevelName(level)}: ${log.message ? `${log.message} ` : ""}${args}`
}
function formatLogs(logs) {
	return logs
		.map(log => formatSingleLog(log))
		.join("\n")
}
function buildLogDecorations(doc) {
	const builder = new RangeSetBuilder()
	const fullText = doc.toString()
	const logs = fullText.split(/\n(?=\[\d{2}:\d{2}:\d{2}\] \[)/)

	let pos = 0
	for (const log of logs) {
		const levelMatch = log.match(/\] (DEBUG|LOG|WARN|ERROR):/)
		const level = levelMatch ? levelMatch[1] : "INFO"

		let levelClass = "log-line-info"
		if (level === "ERROR") levelClass = "log-line-error"
		else if (level === "WARN") levelClass = "log-line-warn"
		else if (level === "DEBUG") levelClass = "log-line-debug"
		else if (level === "LOG") levelClass = "log-line-info"

		builder.add(pos, pos + log.length, Decoration.mark({ class: levelClass }))
		pos += log.length + 1
	}

	return builder.finish()
}
const logDecorationsField = StateField.define({
    create(state) {
        return buildLogDecorations(state.doc)
    },

    update(decorations, transaction) {
        if (transaction.docChanged) {
            return buildLogDecorations(transaction.newDoc)
        }

        return decorations
    },

    provide: f => EditorView.decorations.from(f)
})

function updateEditorContent() {
	if (!view) return

	const newDoc = `${formatLogs(filteredLogs.value)}\n`
	const currentDoc = view.state.doc.toString()

	if (currentDoc === newDoc) return

	view.dispatch({
		changes: {
			from: 0,
			to: currentDoc.length,
			insert: newDoc,
		}
	})

	requestAnimationFrame(() => {
		if (shouldAutoScroll.value) scrollToBottom()
	})
}

function exportLogsToCSV() {
	const rows = logs.value.map(log => {
		const time = new Date(log.ts).toISOString()
		const origin = log.origin || ""
		const source = log.source || ""
		const level = log.level || ""
		const args = (log.args || []).join(" ").replace(/\n/g, " ")
		return [time, origin, source, level, args]
	})

	const csvContent = [
		["time", "origin", "source", "level", "args"],
		...rows
	].map(row =>
		row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
	).join("\n")

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
	const url = URL.createObjectURL(blob)

	const link = document.createElement("a")
	link.setAttribute("href", url)
	link.setAttribute("download", `AzguardWalletLogs_${new Date(Date.now()).toISOString()}.csv`)
	link.style.display = "none"
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)

	URL.revokeObjectURL(url)

	isDownloaded.value = true
	openToast({ label: "Logs are downloaded", icon: "download" }, 2_000)
	setTimeout(() => {
		isDownloaded.value = false
	}, 1_500)
}

const onActiveProfileChanged = (profile) => {
	if (!profile) {
		chrome.windows.getCurrent(window => {
			chrome.windows.remove(window.id)
		})
	}
}

watch(
	() => selectedLevels.value,
	() => {
		updateEditorContent()
	}
)

onMounted(async () => {
	await nextTick()

	profileService = new ProfileServiceClient(undefined, undefined, undefined, undefined, undefined, onActiveProfileChanged)
	loggerService = new LoggerServiceClient(undefined, undefined)
	logs.value = await loggerService.getLogs()
	loggerService.onLogAdded = onLogAdded

	view = new EditorView({
		parent: editorRef.value,
		state: EditorState.create({
			doc: formatLogs(logs.value),
			extensions: [
				keymap.of([...defaultKeymap, ...searchKeymap]),
				...createLoggerTheme(),
				highlightActiveLine(),
				EditorState.readOnly.of(true),
				logDecorationsField,
			]
		})
	})

	view.scrollDOM?.addEventListener("scroll", updateShouldAutoScroll)

	document.addEventListener("selectionchange", () => {
		const selection = document.getSelection()
		if (!selection) return
		if (!selection.isCollapsed) {
			disableAutoScroll()
		}
	})

	document.addEventListener("focusin", e => {
		if ((e.target)?.closest(".cm-panel.cm-search")) {
			disableAutoScroll()
		}
	})

	requestAnimationFrame(() => { scrollToBottom() })
})

onBeforeUnmount(() => {
	loggerService.dispose()

	clearTimeout(scrollTimeout)
	view?.scrollDOM?.removeEventListener("scroll", updateShouldAutoScroll)
})
</script>

<template>
	<div :class="$style.wrapper">
		<Flex align="center" gap="12" :class="$style.actions">
			<Flex
				v-for="level in defLevels"
				@click="handleSelectlevel(level)"
				align="center"
				gap="6"
				:class="[$style.filter_btn, $style[level.toLowerCase()], !selectedLevels.includes(level) && $style.inactive]"
			>
				<Icon
					:name="selectedLevels.includes(level) ? 'check-circle' : 'circle'"
					size="12"
				/>

				<Text size="12">
					{{ capitalize(level.toLowerCase()) }}
				</Text>
			</Flex>

			<Flex :class="$style.action_btn">
				<Icon
					v-if="!isDownloaded"
					@click="exportLogsToCSV"
					name="download-outline"
					size="12"
					color="secondary"
					:class="$style.download_btn"
				/>
				<Icon
					v-else
					name="check"
					size="12"
					color="green"
				/>
			</Flex>
		</Flex>

		<Flex
			v-if="showScrollBtn"
			@click="scrollToBottom"
			align="center"
			:class="$style.scroll_btn"
		>
			<Icon
				name="arrow-right"
				size="24"
				rotate="90"
				color="tertiary"
			/>
		</Flex>

		<div ref="editorRef" :class="$style.logs_viewer" />
	</div>
</template>

<style module>
.wrapper {
	width: 100vw;
	height: 100vh;
	display: flex;
	flex-direction: column;
}

.logs_viewer {
	display: flex;
	flex: 1 1 auto;
	overflow: hidden;
}

.actions {
	position: absolute;
	right: 18px;
	transform: translateY(10px);
	z-index: 1;
}

.filter_btn {
	padding: 4px 8px;
	background-color: var(--card-bg);
	border: 1.5px solid var(--border);
	border-radius: 4px;
	box-shadow: 0 1px 2px var(--shadow-5);

	color: var(--txt-secondary);
	fill: var(--txt-secondary);

	cursor: pointer;

	transition: all 0.2s ease;

	&:hover {
		background: var(--dropdown-bg);
		border-color: var(--txt-tertiary);
		filter: brightness(1);
		* {
			color: var(--txt-primary);
			fill: var(--txt-primary);
		}
	}

	&:active {
		transform: scale(0.95);
	}
}

.warn {
	background-color: var(--log-warn-background);
	color: var(--log-warn-color);

	&:hover {
		background: var(--log-warn-background);
		border-color: var(--log-warn-color);
		filter: brightness(1);
		* {
			background-color: var(--log-warn-background);
			color: var(--log-warn-color);
		}
	}

}

.error {
	background-color: var(--log-error-background);
	color: var(--log-error-color);

	&:hover {
		background: var(--log-error-background);
		border-color: var(--log-error-color);
		filter: brightness(1);
		* {
			background-color: var(--log-error-background);
			color: var(--log-error-color);
		}
	}
}

.inactive {
	filter: brightness(var(--log-inactive-filter));
	color: var(--txt-tertiary);
	fill: var(--txt-tertiary);
}

.action_btn {
	padding: 4px 2px 2px 4px;
	background-color: var(--card-bg);
	border: 1px solid var(--border);
	border-radius: 4px;
	box-shadow: 0 1px 2px var(--shadow-5);

	transition: all 0.2s ease;

	&:hover {
		background: var(--dropdown-bg);
		border-color: var(--txt-tertiary);
		* {
			color: var(--txt-primary);
			fill: var(--txt-primary);
		}
	}

	&:active {
		transform: scale(0.9);
	}
}

.download_btn {
	cursor: pointer;

	&:hover {
		* {
			fill: var(--txt-primary);
		}
	}
}

.scroll_btn {
	position: absolute;
	right: 18px;
	bottom: 18px;
	z-index: 1;

	padding: 4px 4px;
	background-color: var(--card-bg);
	border: 1px solid var(--border);
	border-radius: 50%;
	box-shadow: 0 1px 2px var(--shadow-5);

	cursor: pointer;

	&:hover {
		background: var(--dropdown-bg);
		border-color: var(--border-hovered);
		* {
			fill: var(--txt-secondary);
		}
	}

	&:active {
		transform: scale(0.9);
	}
}
</style>
