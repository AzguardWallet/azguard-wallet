<script setup>
/** Popups */
import MenuPopup from "./MenuPopup.vue"
import NetworksPopup from "./NetworksPopup.vue"
import NewNetworkPopup from "./NewNetworkPopup.vue"
import EditNetworkPopup from "./EditNetworkPopup.vue"
import EditAccountPopup from "./EditAccountPopup.vue"
import AccountsPopup from "./AccountsPopup.vue"
import NewAccountPopup from "./NewAccountPopup.vue"
import SendPopup from "./SendPopup.vue"
import FaucetPopup from "./FaucetPopup.vue"
import ReceivePopup from "./ReceivePopup.vue"
import ResetPopup from "./ResetPopup.vue"
import ForgotPasswordPopup from "./ForgotPasswordPopup.vue"
import ConfirmPopup from "./ConfirmPopup.vue"
import SelectTokenPopup from "./SelectTokenPopup.vue"
import TokensPopup from "./TokensPopup.vue"
import TokenMetadataPopup from "./TokenMetadataPopup.vue"
import NewTokenPopup from "./NewTokenPopup/NewTokenPopup.vue"
import EditTokenPopup from "./EditTokenPopup.vue"
import TransactionPopup from "./TransactionPopup.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
	<MenuPopup :show="popupStore.isOpened('menu')" @onClose="popupStore.close('menu')" />
	<FaucetPopup :show="popupStore.isOpened('faucet')" @onClose="popupStore.close('faucet')" />
	<NetworksPopup :show="popupStore.isOpened('networks')" @onClose="popupStore.close('networks')" />
	<NewNetworkPopup :show="popupStore.isOpened('new_network')" @onClose="popupStore.close('new_network')" />
	<EditNetworkPopup :show="popupStore.isOpened('edit_network')" @onClose="popupStore.close('edit_network')" />
	<EditAccountPopup :show="popupStore.isOpened('edit_account')" @onClose="popupStore.close('edit_account')" />
	<AccountsPopup :show="popupStore.isOpened('accounts')" @onClose="popupStore.close('accounts')" />
	<NewAccountPopup :show="popupStore.isOpened('new_account')" @onClose="popupStore.close('new_account')" />
	<SendPopup :show="popupStore.isOpened('send')" @onClose="popupStore.close('send')" />
	<ReceivePopup :show="popupStore.isOpened('receive')" @onClose="popupStore.close('receive')" />
	<ResetPopup :show="popupStore.isOpened('reset')" @onClose="popupStore.close('reset')" />
	<ForgotPasswordPopup
		:show="popupStore.isOpened('forgot_password')"
		@onClose="popupStore.close('forgot_password')"
	/>
	<ConfirmPopup :show="popupStore.isOpened('confirm')" @onClose="popupStore.close('confirm')" />
	<SelectTokenPopup :show="popupStore.isOpened('select_token')" @onClose="popupStore.close('select_token')" />
	<TokensPopup :show="popupStore.isOpened('tokens')" @onClose="popupStore.close('tokens')" />
	<TokenMetadataPopup :show="popupStore.isOpened('token_metadata')" @onClose="popupStore.close('token_metadata')" />
	<NewTokenPopup :show="popupStore.isOpened('new_token')" @onClose="popupStore.close('new_token')" />
	<EditTokenPopup :show="popupStore.isOpened('edit_token')" @onClose="popupStore.close('edit_token')" />
	<TransactionPopup :show="popupStore.isOpened('tx')" @onClose="popupStore.close('tx')" />
</template>
