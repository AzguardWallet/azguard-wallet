/** Vendor */
import { ref, onUnmounted } from "vue"

type TickerEntry = {
	now: ReturnType<typeof ref<number>>
	users: number
	interval: ReturnType<typeof setInterval> | null
}

const tickers = new Map<number, TickerEntry>()

export function useTicker(period = 60_000) {
	let entry = tickers.get(period)

	if (!entry) {
		entry = {
			now: ref(Date.now()),
			users: 0,
			interval: setInterval(() => {
				entry!.now.value = Date.now()
			}, period),
		}

		tickers.set(period, entry)
	}

	entry.users++

	onUnmounted(() => {
		entry!.users--
		if (entry!.users === 0 && entry!.interval) {
			clearInterval(entry!.interval)
			tickers.delete(period)
		}
	})

	return entry.now
}
