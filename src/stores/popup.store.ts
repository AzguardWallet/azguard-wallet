import { defineStore } from "pinia"

type OpenedPopups = {
	[key: string]: number
}

export const usePopupStore = defineStore("popup", () => {
	const popups = ref<OpenedPopups>({})
	const len = computed(() => Object.keys(popups.value).length)

	const isOpened = (target: string) => {
		return target in popups.value
	}
	const open = (target: string) => {
		popups.value[target] = Object.keys(popups.value).length
	}
	const close = (target: string) => {
		if (target in popups.value) delete popups.value[target]
	}
	const closeAll = () => {
		popups.value = {}
	}

	return { popups, len, isOpened, open, close, closeAll }
})
