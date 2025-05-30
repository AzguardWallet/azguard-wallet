/** Utils */
import { checkAztecVersion,	managers, setAztecVersion } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useNotificationStore } from "@/stores/notification.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const notificationStore = useNotificationStore()
const popupStore = usePopupStore()

export const getTemplate = (name, params) => {
    switch (name) {
        case "aztecReset":
            return {
                type: "warning",
                autoDestroy: false,
                payload: {
                    title: "Testnet Update",
                    description: "Aztec testnet was reset. Please delete your profile and create a new one to ensure compatibility with the new version.",
                    onConfirm: async () => {
                        await managers.profile.deleteProfile(appStore.profile.id)
                        popupStore.closeAll()
        
                        appStore.profiles = appStore.profiles.filter(p => p.id !== appStore.profile.id)
                        appStore.profile = appStore.profiles.length && appStore.profiles[0]
                        appStore.networks = []
                        appStore.network = null
                        appStore.accounts = []
                        appStore.account = null
                        appStore.balances = []
                        appStore.tokensAwaitingBalanceRefresh = []
                        appStore.tokens = []
                        appStore.transactions = []
                        chrome.storage.local.remove("azguard:ui:feePaymentMethods")
        
                        appStore.isLogined = false
                        appStore.isSessionChecked = false
        
                        if (!appStore.profiles.length) {
                            params.router.push("/popup/register")
                        }
        
                        openToast({ label: "Profile deleted", icon: "check-circle" })
                    },
                    onCancel: async () => {
                        await setAztecVersion()
                    },
                    confirmText: "Delete Profile",
                    cancelText: "Later",
                }
            }
        default:
            break;
    }
}

export async function checkNotificationsForShow(router) {
    const isCurrentAztecVersionSupported = await checkAztecVersion()
    if (!isCurrentAztecVersionSupported) {
        const template = getTemplate("aztecReset", { router })
        notificationStore.create({ ...template })
    }
}
