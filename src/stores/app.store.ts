import { defineStore } from "pinia"

type WalletMock = {
	name: string
	created_at: number
}

export const useAppStore = defineStore("app", () => {
	/** mocked */
	const _wallet = reactive<WalletMock>({
		name: "",
		created_at: 0,
	})
	const _isHomeScreenOpened = ref(false)

	const showSendPopup = ref(false)
	const showRegisterPopup = ref(false)

	const isPrivacyModeEnabled = ref(false)

	return {
		_wallet,
		_isHomeScreenOpened,
		showSendPopup,
		showRegisterPopup,
		isPrivacyModeEnabled,
	}
})
