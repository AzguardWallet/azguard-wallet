import { defineStore } from "pinia"

type OpenedPopups = {
	[key: string]: {
		order: number
		payload?: any
	}
}

export const usePopupStore = defineStore("popup", () => {
	const popups = ref<OpenedPopups>({})
	const len = computed(() => Object.keys(popups.value).length)

	const isOpened = (target: string) => {
		return target in popups.value
	}
	const open = (target: string, payload?: any) => {
		popups.value[target] = {
			order: Object.keys(popups.value).length,
			payload,
		}
	}
	const getPayload = (target: string) => {
		return popups.value[target]?.payload
	}
	const close = (target: string) => {
		if (target in popups.value) delete popups.value[target]
	}
	const closeAll = () => {
		popups.value = {}
	}

	return { popups, len, isOpened, open, close, closeAll, getPayload }
})
