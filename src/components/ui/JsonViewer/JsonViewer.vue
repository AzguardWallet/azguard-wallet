<script setup>
/** Vendor */
import { onMounted, ref } from "vue"
import { EditorView } from "codemirror"
import { EditorState } from "@codemirror/state"
import { keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, drawSelection } from "@codemirror/view"
import { bracketMatching, foldGutter } from "@codemirror/language"
import { defaultKeymap } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { json } from "@codemirror/lang-json"
import { indentationMarkers } from '@replit/codemirror-indentation-markers';

/** Services */
import { customViewerTheme } from "./theme.js";

const props = defineProps({
	data: Object,
	required: true,
})

const editorRef = ref(null)

const initViewer = () => {
	const state = EditorState.create({
		doc: JSON.stringify(props.data, null, 2),
		extensions: [
			// lineNumbers(),
			// foldGutter(),
			highlightActiveLine(),
			highlightActiveLineGutter(),
			highlightSpecialChars(),
			// drawSelection(),
			bracketMatching(),
			highlightSelectionMatches(),
			// indentationMarkers(
			// 	{
			// 		markerType: "codeOnly",
			// 		thickness: 1,
			// 	},
			// ),
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

onMounted(() => {
	nextTick(() => {
		initViewer()
	})
})
</script>

<template>
	<div ref="editorRef" :class="$style.editor" />
</template>

<style module>
.editor {
	padding: 0 8px;
	width: 100%;
	max-height: 500px;
	overflow: auto;
}

::selection {
	background-color: var(--gray-10);
}
</style>
