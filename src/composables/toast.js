const toast = ref()
let closeTm

export const useToast = () => {
	const openToast = (newToast) => {
		toast.value = newToast

		closeTm = setTimeout(() => {
			toast.value = null
		}, 5_000)
	}

	const closeToast = () => {
		clearTimeout(closeTm)
		toast.value = null
	}

	return { toast, openToast, closeToast }
}
