/** Utils */
import { checkSentinel, managers } from "@/utils/core"

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
					title: "Profile Reset Needed",
					description:
						"Due to breaking changes in the new version of Aztec, please, delete your profile and create a new one to ensure compatibility.",
					onConfirm: async () => {
						await managers.profile.deleteProfile(appStore.profile.id)
						popupStore.closeAll()

						appStore.profiles = appStore.profiles.filter((p) => p.id !== appStore.profile.id)
						appStore.profile = appStore.profiles.length && appStore.profiles[0]
						appStore.networks = []
						appStore.network = null
						appStore.accounts = []
						appStore.account = null
						appStore.transactions = []
						appStore.awaitingTransactions = []
						chrome.storage.local.remove("nulo:ui:feePaymentMethods")

						appStore.isLogined = false
						appStore.isSessionChecked = false

						if (!appStore.profiles.length) {
							params.router.push("/popup/register")
						}

						openToast({ label: "Profile deleted", icon: "check-circle" })
					},
					onCancel: async () => {},
					confirmText: "Delete Profile",
					cancelText: "Later",
				},
			}
		default:
			break
	}
}

export async function checkNotificationsForShow(router) {
	const isSentinelValid = await checkSentinel()
	if (!isSentinelValid) {
		const template = getTemplate("aztecReset", { router })
		notificationStore.create({ ...template })
	}
}
