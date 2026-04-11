import { defineStore } from "pinia"

export type NotificationType = "info" | "adv" | "warning" | "error"

export type NotificationPayload = {
	title: string
	description: string
	note?: string
	onConfirm?: () => void
	onCancel?: () => void
	confirmText?: string
	cancelText?: string
}

export type NotificationItem = {
	type: NotificationType
	payload: NotificationPayload
	autoDestroy?: boolean
	delay?: number
}

export const useNotificationStore = defineStore("notification", () => {
	const queue = ref<NotificationItem[]>([])
	const active = ref<NotificationItem | null>(null)

	const showNext = () => {
		active.value = queue.value.shift() || null
		if (active.value?.autoDestroy) {
			setTimeout(() => removeActive(), active.value.delay ?? 4_500)
		}
	}

	const create = (notification: NotificationItem) => {
		const item: NotificationItem = { ...notification }

		queue.value.push(item)

		if (!active.value) {
			showNext()
		}
	}

	const removeActive = () => {
		active.value = null
		showNext()
	}

	return {
		active,
		create,
		removeActive,
	}
})
