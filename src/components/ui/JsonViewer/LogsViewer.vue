<script setup>
/** Vendor */
import { onMounted, ref } from "vue"
import { EditorView } from "codemirror"
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state"
import { keymap, highlightActiveLine, Decoration } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { searchKeymap } from "@codemirror/search"

/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"
import Popover from "@/components/ui/Popover.vue"

/** Utils */
import { Config } from "@/wallet/config"
import { LogLevel } from "@/wallet/logger"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { LogViewerServiceClient } from "@/wallet/services/log-viewer/client"
import { capitalize } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Services */
import { createLoggerTheme } from "./creator.js"

const editorRef = ref(null)
let view = null

const logViewerService = new LogViewerServiceClient()
logViewerService.onLog.add(onLogAdded)

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const logs = ref([])

function getLogLevelName(level) {
	switch (level) {
		case LogLevel.Debug:
			return "DEBUG"
		case LogLevel.Info:
			return "INFO"
		case LogLevel.Warn:
			return "WARN"
		case LogLevel.Error:
			return "ERROR"
		default:
			return level
	}
}

const sources = [
	"account",
	"account-state",
	"auth-registry",
	"config",
	"dapp-interaction",
	"dapp-session",
	"execution",
	"faucet",
	"fpc",
	"log-viewer",
	"logger",
	"network",
	"note",
	"profile",
	"pxe",
	"rpc",
	"task",
	"token",
	"token-balance",
	"transaction",
	"wallet-connect",
]
	.flatMap(x => [x, `${x}-client`])
	.concat(["wallet", "ui"])
const allowedSources = computed(() => new Set(Object.keys(filters.source).filter(k => filters.source[k])))
const levels = ["DEBUG", "INFO", "WARN", "ERROR"]
const allowedLevels = computed(
	() =>
		new Set(
			Object.keys(filters.level)
				.filter(k => filters.level[k])
				.map(l => getLogLevelName(l)),
		),
)
const allOptionsSelected = computed(() => {
	return {
		source: allowedSources.value?.size === sources.length,
		level: allowedLevels.value?.size === levels.length,
	}
})

const filteredLogs = computed(() => logs.value.filter(log => isLogInclude(log)))

const AUTO_SCROLL_TIMEOUT_MS = 30_000
const SCROLL_DISABLE_THRESHOLD = 20
const MAX_LOGS_DIFF = 100
const maxLogsCount = ref(new Config().debugMode ? 10_000 : 1_000)

const shouldAutoScroll = ref(true)
const showScrollBtn = ref(false)
let scrollTimeout = null

const popovers = reactive({
	source: false,
	level: false,
})
const filters = reactive({
	source: sources.reduce((acc, b) => ({ ...acc, [b]: true }), {}),
	level: levels.reduce((acc, b) => ({ ...acc, [b]: true }), {}),
})
const searchTerm = ref("")

const handleOpenPopover = name => {
	popovers[name] = true
}
const onPopoverClose = name => {
	popovers[name] = false
	if (name === "source") {
		searchTerm.value = ""
	}
}
function updateFilter(filter, value) {
	filters[filter][value] = !filters[filter][value]
	updateEditorContent()
}
function handleSelectAll(filter) {
	const value = allOptionsSelected.value[filter]
	Object.keys(filters[filter]).forEach(f => (filters[filter][f] = !value))
	updateEditorContent()
}
function isLogInclude(log) {
	const sourceOk = allowedSources.value.has(log.source)
	const levelOk = allowedLevels.value.has(getLogLevelName(log.level))

	return sourceOk && levelOk
}
function getDisplayName(kind, value) {
	switch (kind) {
		case "source":
			if (value === "fpc" || value === "pxe" || value === "rpc") return value.toUpperCase()
			if (value === "undefined") return `(${value})`

			return value.split("-").map(v => capitalize(v)).join(" ")
		default:
			return capitalize(value.toLowerCase())
	}
}

function onLogAdded(log) {
	logs.value.push(log)

	if (logs.value.length > maxLogsCount.value + MAX_LOGS_DIFF) {
		logs.value.splice(0, MAX_LOGS_DIFF)
	}

	if (!isLogInclude(log)) return

	if (view) {
		const doc = view.state.doc

		if (filteredLogs.value.length > maxLogsCount.value + MAX_LOGS_DIFF) {
			view.dispatch({
				changes: {
					from: doc.line(1).from,
					to: doc.line(MAX_LOGS_DIFF).to + 1,
					insert: "",
				},
			})
		}

		const newLine = `${formatSingleLog(log)}\n`
		view.dispatch({
			changes: {
				from: doc.length,
				insert: newLine,
			},
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
		}),
	})

	showScrollBtn.value = false
}

function formatArg(arg) {
	if (Array.isArray(arg)) {
		if (!arg.length) return ""

		return arg.map(formatArg)
	}

	if (typeof arg === "object") {
		try {
			return JSON.stringify(arg)
		} catch {
			return String(arg)
		}
	}

	return arg
}
function formatSingleLog(log) {
	const date = new Date(log.timestamp)
	const time = `${date.toTimeString().slice(0, 8)}.${date.getMilliseconds().toString().padStart(3, "0")}`

	let data
	if (!log.data) {
		data = ""
	} else if (Array.isArray(log.data) && log.data?.length) {
		data = log.data.map(formatArg).filter(x => x !== undefined).join(" ")
	} else {
		data = formatArg(log.data)
	}

	return `[${time}] [${log.source}] ${getLogLevelName(log.level)}: ${data}`
}
function formatLogs(logs) {
	return logs.map(log => formatSingleLog(log)).join("\n")
}
function buildLogDecorations(doc) {
	const builder = new RangeSetBuilder()
	const fullText = doc.toString()
	const logs = fullText.split(/\n(?=\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[)/)

	let pos = 0
	for (const log of logs) {
		const levelMatch = log.match(/\] (DEBUG|WARN|ERROR):/)
		const level = levelMatch ? levelMatch[1] : "INFO"

		let levelClass = "log-line-info"
		if (level === "ERROR") levelClass = "log-line-error"
		else if (level === "WARN") levelClass = "log-line-warn"
		else if (level === "DEBUG") levelClass = "log-line-debug"

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

	provide: f => EditorView.decorations.from(f),
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
		},
	})

	requestAnimationFrame(() => {
		if (shouldAutoScroll.value) scrollToBottom()
	})
}

function exportLogsToCSV() {
	try {
		const rows = logs.value.map(log => {
			const time = new Date(log.timestamp).toISOString()
			const source = log.source
			const level = getLogLevelName(log.level)

			let data
			if (!log.data) {
				data = ""
			} else if (Array.isArray(log.data) && log.data?.length) {
				data = log.data.map(formatArg).filter(x => x !== undefined).join(" ")
			} else {
				data = formatArg(log.data)
			}

			return [time, source, level, data]
		})

		const csvContent = [["time", "source", "level", "data"], ...rows]
			.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
			.join("\n")

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

		openToast({ label: "Logs are downloaded", icon: "download" }, 2_000)
	} catch (err) {
		openToast({ label: "Failed to download logs", icon: "warning" }, 2_000)
		console.error(err)
	}
}
async function handleClearLogs() {
	try {
		logViewerService.onLog.remove(onLogAdded)
		await logViewerService.clearLogs()
		logViewerService.onLog.add(onLogAdded)

		logs.value = []
		await nextTick()
		updateEditorContent()
	} catch (err) {
		openToast({ label: "Failed to clear logs", icon: "warning" }, 2_000)
		console.error(err)
	}
}

async function getLogs() {
	const res = []
	while (true) {
		const logs = await fetchLogs(1024, res.at(-1)?.id)
		res.push(...logs)
		if (
			logs.length !== 1024 &&
			logs.length !== 256 &&
			logs.length !== 64 &&
			logs.length !== 16 &&
			logs.length !== 4 &&
			logs.length !== 1
		) {
			break
		}
	}
	return res
}

async function fetchLogs(cnt, fromId) {
	try {
		const fetch = logViewerService.getLogs(cnt, fromId)
		const timeout = new Promise((_, reject) => {
			setTimeout(() => reject("Logs fetch timeout"), 500)
		})
		await Promise.race([fetch, timeout])
		return await fetch
	} catch {
		if (cnt === 1) {
			throw new Error("Failed to fetch logs")
		}
		return await fetchLogs(cnt / 4, fromId)
	}
}

async function onSettingUpdate(setting) {
	if (setting.key === "debugMode") {
		maxLogsCount.value = setting.value ? 10_000 : 1_000
		logs.value = await getLogs()
		updateEditorContent()
	}
}

onMounted(async () => {
	await nextTick()

	maxLogsCount.value = (await configService.getValue("debugMode")) ? 10_000 : 1_000
	
	logs.value = await getLogs()

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
			],
		}),
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
		if (e.target?.closest(".cm-panel.cm-search")) {
			disableAutoScroll()
		}
	})

	requestAnimationFrame(() => {
		scrollToBottom()
	})
})

onBeforeUnmount(() => {
	logViewerService.disconnect()
	configService.disconnect()

	clearTimeout(scrollTimeout)
	view?.scrollDOM?.removeEventListener("scroll", updateShouldAutoScroll)
})
</script>

<template>
	<div :class="$style.wrapper">
		<Flex align="center" gap="12" :class="$style.actions">
			<Popover
				v-for="p in Object.keys(popovers)"
				:open="popovers[p]"
				@on-close="onPopoverClose(p)"
				side="left"
				:width="p === 'source' ? '160' : '136'"
			>
				<Flex
					@click="handleOpenPopover(p)"
					align="center"
					gap="4"
					:class="[$style.filter_button, !allOptionsSelected[p] && $style.filter_button_active]"
				>
					<Icon :name="allOptionsSelected[p] ? 'filter-outline' : 'filter'" size="14" />

					<Text size="12"> {{ capitalize(p) }} </Text>
				</Flex>

				<template #content>
					<Flex direction="column" gap="4" :class="$style.filter_content_wrapper">
						<Flex direction="column" gap="8" wide :class="$style.filter_content_title">
							<Text size="12" color="tertiary"> {{ `Filter by log ${p}` }} </Text>

							<Input
								v-if="p === 'source'"
								v-model="searchTerm"
								size="mini"
								placeholder="Search"
								autofocus
								:class="$style.filter_content_input"
							/>
						</Flex>
						<Flex
							align="start"
							direction="column"
							gap="4"
							:class="p === 'source' && $style.filter_items_wrapper"
						>
							<Flex
								v-if="!searchTerm"
								@click="handleSelectAll(p)"
								align="center"
								justify="start"
								gap="8"
								wide
								:class="$style.filter_content_item"
							>
								<Icon :name="allOptionsSelected[p] ? 'check-circle' : 'circle'" size="12" />
								<Text size="12"> Select All </Text>
							</Flex>

							<Flex
								v-if="
									p === 'source'
										? Object.keys(filters[p])?.filter(s => s.includes(searchTerm?.toLowerCase()))
												?.length
										: Object.keys(filters[p])?.length
								"
								v-for="k in p === 'source'
									? Object.keys(filters[p])?.filter(s => s.includes(searchTerm?.toLowerCase()))
									: Object.keys(filters[p])"
								@click="updateFilter(p, k)"
								align="center"
								gap="8"
								wide
								:class="[$style.filter_content_item, !filters[p][k] && $style.inactive]"
							>
								<Icon :name="filters[p][k] ? 'check-circle' : 'circle'" size="12" />

								<Text size="12">
									{{ getDisplayName(p, k) }}
								</Text>
							</Flex>
							<Flex v-else align="center" justify="center" wide :class="$style.empty_content">
								<Text size="12" weight="500" color="tertiary">Nothing was found</Text>
							</Flex>
						</Flex>
					</Flex>
				</template>
			</Popover>

			<Dropdown>
				<Flex align="center" gap="4" :class="$style.filter_button">
					<Icon name="dots" size="14" />
				</Flex>

				<template #popup>
					<DropdownItem @click="exportLogsToCSV" :class="$style.filter_content_item">
						<Flex align="center" gap="8">
							<Icon name="download-outline" size="12" />
							<Text size="12">Export logs to CSV</Text>
						</Flex>
					</DropdownItem>
					<DropdownItem @click="handleClearLogs" :class="$style.filter_content_item">
						<Flex align="center" gap="6">
							<Icon name="close" size="14" style="padding-right: 4px" />
							Clear logs
						</Flex>
					</DropdownItem>
				</template>
			</Dropdown>
		</Flex>

		<Flex v-if="showScrollBtn" @click="scrollToBottom" align="center" :class="$style.scroll_btn">
			<Icon name="arrow-right" size="24" rotate="90" color="tertiary" />
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

.filter_button {
	padding: 6px 8px;
	background-color: var(--dropdown-bg);
	border: 1px solid var(--border);
	border-radius: 6px;

	color: var(--txt-secondary);
	fill: var(--txt-secondary);

	cursor: pointer;

	transition: all 0.1s ease;

	&:hover {
		border-color: var(--txt-tertiary);

		* {
			color: var(--txt-primary);
			fill: var(--txt-primary);
		}
	}
}

.filter_button_active {
	fill: var(--blue);

	&:hover {
		* {
			fill: var(--blue);
		}
	}
}

.filter_content_wrapper {
	padding: 2px 8px 0 8px;
	min-height: 0;
	flex: 1;
}

.filter_content_title {
	border-bottom: 1.5px solid var(--border);
	padding-bottom: 8px;
}

.filter_items_wrapper {
	flex: 1;

	min-height: 0;
	max-height: 200px;

	overflow-y: scroll;
	scrollbar-width: thin;
	scrollbar-color: var(--txt-tertiary) transparent;
}

.filter_content_item {
	padding: 6px 8px;
	background-color: var(--dropdown-bg);
	border-radius: 4px;

	color: var(--txt-secondary);
	fill: var(--txt-secondary);

	cursor: pointer;

	transition: all 0.1s ease;

	&:hover {
		background: var(--gray-5);
		* {
			color: var(--txt-primary);
			fill: var(--txt-primary);
		}
	}
}

.inactive {
	color: var(--txt-tertiary);
	fill: var(--txt-tertiary);
}

.empty_content {
	padding: 6px 0;
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
