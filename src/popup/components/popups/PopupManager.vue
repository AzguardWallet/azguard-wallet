<script setup>
/** Popups */
import NetworksPopup from "./NetworksPopup.vue"
import AccountsPopup from "./AccountsPopup.vue"
import NewAccountPopup from "./NewAccountPopup.vue"
import SendPopup from "./SendPopup.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
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
</template>
