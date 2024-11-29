<script setup>
/** Popups */
import SettingsPopup from "./SettingsPopup.vue"
import NetworksPopup from "./NetworksPopup.vue"
import AccountsPopup from "./AccountsPopup.vue"
import NewAccountPopup from "./NewAccountPopup.vue"
import SendPopup from "./SendPopup.vue"
import ConnectByURI from "./ConnectByURI.vue"
import ReceivePopup from "./ReceivePopup.vue"
import ResetPopup from "./ResetPopup.vue"
import ConfirmPopup from "./ConfirmPopup.vue"
import SelectTokenPopup from "./SelectTokenPopup.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
	<SettingsPopup
		:show="popupStore.isOpened('settings')"
		@onClose="popupStore.close('settings')"
	/>
	<NetworksPopup
		:show="popupStore.isOpened('networks')"
		@onClose="popupStore.close('networks')"
	/>
	<AccountsPopup
		:show="popupStore.isOpened('accounts')"
		@onClose="popupStore.close('accounts')"
	/>
	<NewAccountPopup
		:show="popupStore.isOpened('new_account')"
		@onClose="popupStore.close('new_account')"
	/>
	<SendPopup
		:show="popupStore.isOpened('send')"
		@onClose="popupStore.close('send')"
	/>
	<ConnectByURI
		:show="popupStore.isOpened('connectByURI')"
		@onClose="popupStore.close('connectByURI')"
	/>
	<ReceivePopup
		:show="popupStore.isOpened('receive')"
		@onClose="popupStore.close('receive')"
	/>
	<ResetPopup
		:show="popupStore.isOpened('reset')"
		@onClose="popupStore.close('reset')"
	/>
	<ConfirmPopup
		:show="popupStore.isOpened('confirm')"
		@onClose="popupStore.close('confirm')"
	/>
	<SelectTokenPopup
		:show="popupStore.isOpened('select_token')"
		@onClose="popupStore.close('select_token')"
	/>
</template>
