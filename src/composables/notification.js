/** Utils */
import { checkProfileSentinel } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useNotificationStore } from "@/stores/notification.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const notificationStore = useNotificationStore()
const popupStore = usePopupStore()

export const getTemplate = (name) => {
    switch (name) {
        case "aztecReset":
            return {
                type: "warning",
                autoDestroy: false,
                payload: {
                    title: "Profile Reset Needed",
                    description: "A breaking Aztec upgrade made this profile incompatible with the current wallet. If you have assets, back them up before resetting.",
                    onConfirm: async () => {
                        popupStore.open("reset")
                    },
                    onCancel: async () => {},
                    confirmText: "Continue",
                    cancelText: "Later",
                }
            }
        default:
            break;
    }
}

export async function checkNotificationsForShow() {
    const isSentinelValid = checkProfileSentinel(appStore.profile)
    if (!isSentinelValid) {
        const template = getTemplate("aztecReset")
        notificationStore.create({ ...template })
    }
}
