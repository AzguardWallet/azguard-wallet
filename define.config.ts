import packageJson from "./package.json"

export const defineViteConfig = {
	__VERSION__: JSON.stringify(packageJson.version),
	__NAME__: JSON.stringify(packageJson.name),
	__DISPLAY_NAME__: JSON.stringify(packageJson.displayName),

	"import.meta.env.HTML_TITLE": JSON.stringify(packageJson.displayName),

	"process.env": process.env,
	"process.version": JSON.stringify(process.version),
	global: {},
}
