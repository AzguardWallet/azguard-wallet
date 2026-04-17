<script setup>
/** Vendor */
import { onMounted, ref } from "vue"
import { EditorView } from "codemirror"
import { EditorState } from "@codemirror/state"
import { keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars } from "@codemirror/view"
import { bracketMatching, foldGutter } from "@codemirror/language"
import { defaultKeymap } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { json } from "@codemirror/lang-json"
import { indentationMarkers } from "@replit/codemirror-indentation-markers"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Services */
import { customViewerTheme } from "./theme.js"

const props = defineProps({
	data: {
		type: Object,
		required: true,
	},
	requestId: {
		type: [Number, String],
		required: false,
	},
	fullscreen: {
		type: Boolean,
		default: false,
	},
})

const editorRef = ref(null)

const fullscreenSettings = [
	lineNumbers(),
	foldGutter(),
	indentationMarkers({
		markerType: "codeOnly",
		thickness: 1,
	}),
]
const initViewer = () => {
	const state = EditorState.create({
		doc: JSON.stringify(props.data, null, 2),
		extensions: [
			highlightActiveLine(),
			highlightActiveLineGutter(),
			highlightSpecialChars(),
			// drawSelection(),
			bracketMatching(),
			highlightSelectionMatches(),
			props.fullscreen ? [...fullscreenSettings] : [],
			keymap.of([...defaultKeymap, ...searchKeymap]),
			customViewerTheme,
			EditorState.readOnly.of(true),
			// EditorView.lineWrapping,
			json(),
		],
	})

	const editorView = new EditorView({
		state,
		parent: editorRef.value,
	})
}

const isCopied = ref(false)

const handleCopy = () => {
	isCopied.value = true

	window.navigator.clipboard.writeText(JSON.stringify(props.data))

	openToast({ label: "Data is copied", icon: "copy" })

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
}

const handleFullscreenView = () => {
	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/json"))
	url.searchParams.set("requestId", props.requestId)

	chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 900 })
}

onMounted(() => {
	nextTick(() => {
		initViewer()
	})
})
</script>

<template>
	<div :class="$style.wrapper">
		<Icon
			v-if="!fullscreen && requestId"
			@click="handleFullscreenView"
			name="expand"
			size="16"
			color="tertiary"
			:class="$style.fullscreen_icon"
		/>

		<Icon
			@click="handleCopy"
			:name="isCopied ? 'check-circle' : 'copy'"
			size="16"
			:color="isCopied ? 'green' : 'tertiary'"
			:class="$style.copy_icon"
		/>

		<div ref="editorRef" :class="$style.editor" />
	</div>
</template>

<style module>
.wrapper {
	width: 100%;
	height: 100%;
}

.editor {
	padding: 0 8px;
	width: 100%;
	height: 100%;
	overflow: auto;
}

.copy_icon {
	position: absolute;
	right: 30px;
	transform: translateY(5px);
	z-index: 1;

	background: transparent;
	box-sizing: content-box;
	cursor: pointer;
	border-radius: 5px;

	padding: 4px;

	transition: all 0.5s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}
}

.fullscreen_icon {
	position: absolute;
	right: 54px;
	transform: translateY(5px);
	z-index: 1;

	background: transparent;
	box-sizing: content-box;
	cursor: pointer;
	border-radius: 5px;

	padding: 4px;

	transition: all 0.5s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}
}

::selection {
	background-color: var(--nulo-surface-highest);
}
</style>
