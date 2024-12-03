const SETTINGS_STORAGE_KEY = "azguard:ui:settings"
const defaultSettings = {
	appearance: {
		theme: "dark",
		sidePanel: false,
	},
	developer: {
		advancedMode: false,
	},
}

const root = document.querySelector("html")

const settings = ref({})

export const useSettings = () => {
	const syncLocalSettings = async () => {
		const localSettings = await chrome.storage.local.get(
			SETTINGS_STORAGE_KEY
		)

		if (!Object.keys(localSettings).length) {
			settings.value = defaultSettings
			await chrome.storage.local.set({
				[SETTINGS_STORAGE_KEY]: settings.value,
			})
		}

		if (SETTINGS_STORAGE_KEY in localSettings) {
			settings.value = localSettings[SETTINGS_STORAGE_KEY]

			/** restore */
			if (
				Object.keys(localSettings[SETTINGS_STORAGE_KEY]).length !==
				Object.keys(defaultSettings).length
			) {
				const missingSettings = []

				for (const setting of Object.keys(defaultSettings)) {
					if (!(setting in localSettings[SETTINGS_STORAGE_KEY])) {
						missingSettings.push(setting)
					}
				}

				for (const missingSetting of missingSettings) {
					settings.value[missingSetting] =
						defaultSettings[missingSetting]
				}

				await chrome.storage.local.set({
					[SETTINGS_STORAGE_KEY]: settings.value,
				})
			}
		}

		/** Theme */
		root.setAttribute("theme", settings.value.appearance.theme)

		/** Side Panel */
		chrome.sidePanel.setPanelBehavior({
			openPanelOnActionClick: settings.value.appearance.sidePanel,
		})
	}

	const updateSettings = async (section, key, value) => {
		if (!settings.value[section]) {
			throw new Error(`Unknown section '${section}'`)
		}
		if (!(key in settings.value[section])) {
			throw new Error(`Unknown key in section '${section}'`)
		}

		settings.value[section][key] = value
		await chrome.storage.local.set({
			[SETTINGS_STORAGE_KEY]: settings.value,
		})
	}

	const resetSettings = async () => {}

	return { settings, syncLocalSettings, updateSettings, resetSettings }
}
