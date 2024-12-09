/**
 * Vendor
 */
import { tags as t } from "@lezer/highlight"

/**
 * Local
 */
import { createTheme } from "./creator"

export const customViewerTheme = createTheme({
	styles: [
		{
			tag: t.comment,
			color: "var(--txt-tertiary)",
			sd: true,
			asd: 123

		},
		{
			tag: t.bracket,
			color: "var(--txt-support)",
		},
		{
			tag: [t.string, t.special(t.brace)],
			color: "var(--json-string)",
		},
		{
			tag: [t.number, t.self, t.null],
			color: "var(--json-number)",
		},
		{
			tag: t.bool,
			color: "var(--json-bool)",
		},
		{
			tag: [t.keyword, t.propertyName],
			color: "var(--json-property-name)",
		},
		{
			tag: [t.definitionKeyword, t.typeName],
			color: "#DCBDFB",
		},
		{
			tag: t.definition(t.typeName),
			color: "#f8f8f2",
		},
		{
			tag: [t.className, t.definition(t.propertyName), t.function(t.variableName), t.attributeName],
			color: "#F2994A",
		},
	],
})
