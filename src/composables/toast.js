const toast = ref()
let closeTm

export const useToast = () => {
	const openToast = (newToast, duration = 5_000) => {
		toast.value = newToast

		closeTm = setTimeout(() => {
			toast.value = null
		}, duration)
	}

	const closeToast = () => {
		clearTimeout(closeTm)
		toast.value = null
	}

	return { toast, openToast, closeToast }
}
