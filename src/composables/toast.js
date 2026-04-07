/** Standard toast durations (ms). */
export const TOAST_DURATION = {
	/** Quick feedback: copy, settings toggle. */
	SHORT: 1_500,
	/** Standard: success, download, info. */
	DEFAULT: 2_000,
	/** Longer: errors, warnings. */
	LONG: 4_000,
}

const toast = ref()
let closeTm

export const useToast = () => {
	const openToast = (newToast, duration = TOAST_DURATION.DEFAULT) => {
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
