export interface IEventHandler<T> {
	add: (callback: (payload: T) => void) => void
	remove: (callback: (payload: T) => void) => void
}

export class EventHandler<T> implements IEventHandler<T> {
	#callbacks: ((payload: T) => void)[] = []

	public add(callback: (payload: T) => void) {
		if (!this.#callbacks.includes(callback)) {
			this.#callbacks.push(callback)
		}
	}

	public remove(callback: (payload: T) => void) {
		const index = this.#callbacks.indexOf(callback)
		if (index !== -1) {
			this.#callbacks.splice(index, 1)
		}
	}

	public invoke(payload: T) {
		for (const callback of this.#callbacks) {
			try {
				callback(payload)
			} catch {}
		}
	}
}
