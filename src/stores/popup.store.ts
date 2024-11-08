import { defineStore } from "pinia"

type OpenedPopups = {
	[key: string]: boolean
}

export const usePopupStore = defineStore("popup", () => {
	const popups = ref<string[]>([])

	const isOpened = (target: string) => {
		return popups.value.includes(target)
	}
	const open = (target: string) => {
		popups.value.push(target)
	}
	const close = (target: string) => {
		popups.value.splice(popups.value.indexOf(target), 1)
	}

	return { popups, isOpened, open, close }
})
