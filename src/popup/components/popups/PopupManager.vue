<script setup>
/** Popups */
import MenuPopup from "./MenuPopup.vue"
import NetworksPopup from "./NetworksPopup.vue"
import NewNetworkPopup from "./NewNetworkPopup.vue"
import EditNetworkPopup from "./EditNetworkPopup.vue"
import SelectNetworksPopup from "./SelectNetworksPopup.vue"
import EditAccountPopup from "./EditAccountPopup.vue"
import AccountsPopup from "./AccountsPopup.vue"
import NewAccountPopup from "./NewAccountPopup.vue"
import SendPopup from "./SendPopup.vue"
import NotePopup from "./NotePopup.vue"
import ConnectByURIPopup from "./ConnectByURIPopup.vue"
import FaucetPopup from "./FaucetPopup.vue"
import ReceivePopup from "./ReceivePopup.vue"
import ResetPopup from "./ResetPopup.vue"
import ForgotPasswordPopup from "./ForgotPasswordPopup.vue"
import ImportPopup from "./ImportPopup.vue"
import ConfirmPopup from "./ConfirmPopup.vue"
import SelectTokenPopup from "./SelectTokenPopup.vue"
import SelectProfilePopup from "./SelectProfilePopup.vue"
import TokensPopup from "./TokensPopup.vue"
import TokenMetadataPopup from "./TokenMetadataPopup.vue"
import NewTokenPopup from "./NewTokenPopup/NewTokenPopup.vue"
import EditTokenPopup from "./EditTokenPopup.vue"
import TransactionPopup from "./TransactionPopup.vue"
import SelectBalanceTypePopup from "./SelectBalanceTypePopup.vue"
import NewFpcPopup from "./NewFpcPopup.vue"
import EditFpcPopup from "./EditFpcPopup.vue"
import SelectFpcPopup from "./SelectFpcPopup.vue"
import EditClaimParametersPopup from "./EditClaimParametersPopup.vue"

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
	<SelectNetworksPopup :show="popupStore.isOpened('select_network')" @onClose="popupStore.close('select_network')" />
	<EditAccountPopup :show="popupStore.isOpened('edit_account')" @onClose="popupStore.close('edit_account')" />
	<AccountsPopup :show="popupStore.isOpened('accounts')" @onClose="popupStore.close('accounts')" />
	<NewAccountPopup :show="popupStore.isOpened('new_account')" @onClose="popupStore.close('new_account')" />
	<SendPopup :show="popupStore.isOpened('send')" @onClose="popupStore.close('send')" />
	<NotePopup :show="popupStore.isOpened('note')" @onClose="popupStore.close('note')" />
	<ConnectByURIPopup :show="popupStore.isOpened('connect_by_uri')" @onClose="popupStore.close('connect_by_uri')" />
	<ReceivePopup :show="popupStore.isOpened('receive')" @onClose="popupStore.close('receive')" />
	<ResetPopup :show="popupStore.isOpened('reset')" @onClose="popupStore.close('reset')" />
	<ForgotPasswordPopup
		:show="popupStore.isOpened('forgot_password')"
		@onClose="popupStore.close('forgot_password')"
	/>
	<ImportPopup :show="popupStore.isOpened('import')" @onClose="popupStore.close('import')" />
	<ConfirmPopup :show="popupStore.isOpened('confirm')" @onClose="popupStore.close('confirm')" />
	<SelectTokenPopup :show="popupStore.isOpened('select_token')" @onClose="popupStore.close('select_token')" />
	<SelectProfilePopup :show="popupStore.isOpened('select_profile')" @onClose="popupStore.close('select_profile')" />
	<TokensPopup :show="popupStore.isOpened('tokens')" @onClose="popupStore.close('tokens')" />
	<TokenMetadataPopup :show="popupStore.isOpened('token_metadata')" @onClose="popupStore.close('token_metadata')" />
	<NewTokenPopup :show="popupStore.isOpened('new_token')" @onClose="popupStore.close('new_token')" />
	<EditTokenPopup :show="popupStore.isOpened('edit_token')" @onClose="popupStore.close('edit_token')" />
	<TransactionPopup :show="popupStore.isOpened('tx')" @onClose="popupStore.close('tx')" />
	<SelectBalanceTypePopup
		:show="popupStore.isOpened('select_balance_type')"
		@onClose="popupStore.close('select_balance_type')"
	/>
	<NewFpcPopup :show="popupStore.isOpened('new_fpc')" @onClose="popupStore.close('new_fpc')" />
	<EditFpcPopup :show="popupStore.isOpened('edit_fpc')" @onClose="popupStore.close('edit_fpc')" />
	<SelectFpcPopup :show="popupStore.isOpened('select_fpc')" @onClose="popupStore.close('select_fpc')" />
	<EditClaimParametersPopup :show="popupStore.isOpened('edit_claim_parameters')" @onClose="popupStore.close('edit_claim_parameters')" />
</template>
