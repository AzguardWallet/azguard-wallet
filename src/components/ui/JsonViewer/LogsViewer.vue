<script setup>
/** Vendor */
import { onMounted, ref, watch } from "vue"
import { EditorView } from "codemirror"
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state"
import {
	keymap,
	highlightActiveLine,
	Decoration,
} from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { searchKeymap } from "@codemirror/search"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Services */
import { createLoggerTheme } from "./creator.js"

const props = defineProps({
	logs: {
		type: Array,
		required: true,
	},
})

const editorRef = ref(null)
let view = null

const AUTO_SCROLL_TIMEOUT_MS = 30_000
const shouldAutoScroll = ref(true)
let scrollTimeout = null
function enableAutoScroll() {
	clearTimeout(scrollTimeout);
	shouldAutoScroll.value = true;
}
function disableAutoScroll() {
	clearTimeout(scrollTimeout);
	shouldAutoScroll.value = false;

	scrollTimeout = setTimeout(() => {
		shouldAutoScroll.value = true;
	}, AUTO_SCROLL_TIMEOUT_MS);
}
function updateShouldAutoScroll() {
	const el = view?.scrollDOM;
	if (!el) return;
	const threshold = 20;

	const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
	// shouldAutoScroll.value = isAtBottom;

	if (isAtBottom) {
		enableAutoScroll();
	} else {
		disableAutoScroll();
	}
}
function scrollToBottom(smooth = true) {
	const el = view?.scrollDOM
	if (!el) return

	el.scrollTo({
		top: el.scrollHeight,
		behavior: smooth ? "smooth" : "auto"
	});
}

function formatSingleLog(log) {
	const time = new Date(log.ts).toLocaleTimeString();
	const level = log.level.toUpperCase();
	const args = (log.args || []).map(String).join(" ");
	return `[${time}] [${log.source}] ${level}: ${log.message ? `${log.message} ` : ""}${args}`;
}
function formatLogs(logs) {
	return logs
		.map(log => formatSingleLog(log))
		.join("\n");
}
function buildLogDecorations(doc) {
	const builder = new RangeSetBuilder()
	const lines = doc.toString().split("\n")
	let pos = 0

	for (const line of lines) {
		const levelMatch = line.match(/\] (DEBUG|INFO|WARN|ERROR):/)
		const level = levelMatch ? levelMatch[1] : "INFO"

		let levelClass = "log-line-info"
		if (level === "ERROR") levelClass = "log-line-error"
		else if (level === "WARN") levelClass = "log-line-warn"
		else if (level === "DEBUG") levelClass = "log-line-debug"
		else if (level === "INFO") levelClass = "log-line-info"

		builder.add(pos, pos, Decoration.line({ class: levelClass }))

		pos += line.length + 1
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

watch(() => props.logs, (newLogs) => {
	if (view) {
		const newLog = newLogs[newLogs.length - 1];
		if (!newLog) return;

		const newLine = `${formatSingleLog(newLog)}\n`;
		view.dispatch({
			changes: {
				from: view.state.doc.length,
				insert: newLine
			}
		});

		if (shouldAutoScroll.value) {
			scrollToBottom()
		}
	}
}, { deep: true })

onMounted(() => {
	nextTick(() => {
		view = new EditorView({
			parent: editorRef.value,
			state: EditorState.create({
				doc: formatLogs(props.logs),
				extensions: [
					keymap.of([...defaultKeymap, ...searchKeymap]),
					...createLoggerTheme(),
					highlightActiveLine(),
					EditorState.readOnly.of(true),
					logDecorationsField,
				]
			})
		})

		scrollToBottom()

		view.scrollDOM?.addEventListener("scroll", updateShouldAutoScroll);

		document.addEventListener("selectionchange", () => {
		const selection = document.getSelection();
			if (!selection) return;
			if (!selection.isCollapsed) {
				disableAutoScroll();
			}
		});

		document.addEventListener("focusin", e => {
			if ((e.target)?.closest(".cm-panel.cm-search")) {
				disableAutoScroll();
			}
		});
	})
})

onBeforeUnmount(() => {
	clearTimeout(scrollTimeout);
	view?.scrollDOM?.removeEventListener("scroll", updateShouldAutoScroll);
});
</script>

<template>
	<div :class="$style.wrapper">
		<div ref="editorRef" :class="$style.console_viewer" />
	</div>
</template>

<style module>
.wrapper {
	width: 100vw;
	height: 100vh;
	display: flex;
	flex-direction: column;
}

.console_viewer {
	display: flex;
	flex: 1 1 auto;
	border: 1px solid #444;
	border-radius: 4px;
	overflow: hidden;
}
</style>
