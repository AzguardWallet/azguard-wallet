<script setup>
/** Components */
import AccountsPopup from "./AccountsPopup.vue"
import ChangeAuthwitsRegistryPopup from "./ChangeAuthwitsRegistryPopup.vue"
import ChangeProfilePasswordPopup from "./ChangeProfilePasswordPopup.vue"
import ConfirmPopup from "./ConfirmPopup.vue"
import DataViewerPopup from "./DataViewerPopup.vue"
import EditAccountPopup from "./EditAccountPopup.vue"
import EditClaimParametersPopup from "./EditClaimParametersPopup.vue"
import EditContactPopup from "./EditContactPopup.vue"
import EditFpcPopup from "./EditFpcPopup.vue"
import EditNetworkPopup from "./EditNetworkPopup.vue"
import EditProfilePopup from "./EditProfilePopup.vue"
import EditTokenPopup from "./EditTokenPopup.vue"
import ForgotPasswordPopup from "./ForgotPasswordPopup.vue"
import ImportContactsPopup from "./ImportContactsPopup.vue"
import ImportPopup from "./ImportPopup.vue"
import MenuPopup from "./MenuPopup.vue"
import NetworksPopup from "./NetworksPopup.vue"
import NewAccountPopup from "./NewAccountPopup.vue"
import NewContactPopup from "./NewContactPopup.vue"
import NewFpcPopup from "./NewFpcPopup.vue"
import NewNetworkPopup from "./NewNetworkPopup.vue"
import NewSenderPopup from "./NewSenderPopup.vue"
import NewTokenPopup from "./NewTokenPopup/NewTokenPopup.vue"
import ReceivePopup from "./ReceivePopup.vue"
import ResetPopup from "./ResetPopup.vue"
import RevokeAuthwitsPopup from "./RevokeAuthwitsPopup.vue"
import SelectBalanceTypePopup from "./SelectBalanceTypePopup.vue"
import SelectFpcPopup from "./SelectFpcPopup.vue"
import SelectNetworksPopup from "./SelectNetworksPopup.vue"
import SelectProfilePopup from "./SelectProfilePopup.vue"
import SelectTokenPopup from "./SelectTokenPopup.vue"
import SendPopup from "./SendPopup.vue"
import StealthPromoPopup from "./StealthPromoPopup.vue"
import TokenMetadataPopup from "./TokenMetadataPopup.vue"
import TransactionPopup from "./TransactionPopup.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
	<MenuPopup :show="popupStore.isOpened('menu')" @onClose="popupStore.close('menu')" />

	<ImportPopup :show="popupStore.isOpened('import')" @onClose="popupStore.close('import')" />
	<ResetPopup :show="popupStore.isOpened('reset')" @onClose="popupStore.close('reset')" />
	<ForgotPasswordPopup :show="popupStore.isOpened('forgot_password')" @onClose="popupStore.close('forgot_password')" />

	<ConfirmPopup :show="popupStore.isOpened('confirm')" @onClose="popupStore.close('confirm')" />
	<DataViewerPopup :show="popupStore.isOpened('data_viewer')" @onClose="popupStore.close('data_viewer')" />

	<ChangeProfilePasswordPopup :show="popupStore.isOpened('change_profile_password')" @onClose="popupStore.close('change_profile_password')" />
	<EditProfilePopup :show="popupStore.isOpened('edit_profile')" @onClose="popupStore.close('edit_profile')" />
	<SelectProfilePopup :show="popupStore.isOpened('select_profile')" @onClose="popupStore.close('select_profile')" />

	<NetworksPopup :show="popupStore.isOpened('networks')" @onClose="popupStore.close('networks')" />
	<NewNetworkPopup :show="popupStore.isOpened('new_network')" @onClose="popupStore.close('new_network')" />
	<EditNetworkPopup :show="popupStore.isOpened('edit_network')" @onClose="popupStore.close('edit_network')" />
	<SelectNetworksPopup :show="popupStore.isOpened('select_network')" @onClose="popupStore.close('select_network')" />

	<AccountsPopup :show="popupStore.isOpened('accounts')" @onClose="popupStore.close('accounts')" />
	<NewAccountPopup :show="popupStore.isOpened('new_account')" @onClose="popupStore.close('new_account')" />
	<EditAccountPopup :show="popupStore.isOpened('edit_account')" @onClose="popupStore.close('edit_account')" />

	<TokenMetadataPopup :show="popupStore.isOpened('token_metadata')" @onClose="popupStore.close('token_metadata')" />
	<NewTokenPopup :show="popupStore.isOpened('new_token')" @onClose="popupStore.close('new_token')" />
	<EditTokenPopup :show="popupStore.isOpened('edit_token')" @onClose="popupStore.close('edit_token')" />
	<SelectTokenPopup :show="popupStore.isOpened('select_token')" @onClose="popupStore.close('select_token')" />
	<SelectBalanceTypePopup :show="popupStore.isOpened('select_balance_type')" @onClose="popupStore.close('select_balance_type')" />

	<TransactionPopup :show="popupStore.isOpened('tx')" @onClose="popupStore.close('tx')" />

	<NewFpcPopup :show="popupStore.isOpened('new_fpc')" @onClose="popupStore.close('new_fpc')" />
	<EditFpcPopup :show="popupStore.isOpened('edit_fpc')" @onClose="popupStore.close('edit_fpc')" />
	<SelectFpcPopup :show="popupStore.isOpened('select_fpc')" :payload="popupStore.getPayload('select_fpc')" @onClose="popupStore.close('select_fpc')" />

	<NewSenderPopup :show="popupStore.isOpened('new_sender')" @onClose="popupStore.close('new_sender')" />
	<ChangeAuthwitsRegistryPopup :show="popupStore.isOpened('change_authwits_registry')" @onClose="popupStore.close('change_authwits_registry')" />
	<RevokeAuthwitsPopup :show="popupStore.isOpened('revoke_authwits')" @onClose="popupStore.close('revoke_authwits')" />

	<NewContactPopup :show="popupStore.isOpened('new_contact')" @onClose="popupStore.close('new_contact')" />
	<EditContactPopup :show="popupStore.isOpened('edit_contact')" @onClose="popupStore.close('edit_contact')" />
	<ImportContactsPopup :show="popupStore.isOpened('import_contacts')" @onClose="popupStore.close('import_contacts')" />

	<SendPopup :show="popupStore.isOpened('send')" @onClose="popupStore.close('send')" />
	<ReceivePopup :show="popupStore.isOpened('receive')" @onClose="popupStore.close('receive')" />
	<EditClaimParametersPopup :show="popupStore.isOpened('edit_claim_parameters')" :payload="popupStore.getPayload('edit_claim_parameters')" @onClose="popupStore.close('edit_claim_parameters')" />

	<StealthPromoPopup :show="popupStore.isOpened('stealth_promo')" @onClose="popupStore.close('stealth_promo')" />
</template>
