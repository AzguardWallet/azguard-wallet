export interface IEventHandler<T> {
	add: (callback: (payload: T) => any) => void
	remove: (callback: (payload: T) => any) => void
}

export class EventHandler<T> implements IEventHandler<T> {
	#callbacks: ((payload: T) => any)[] = []

	public add(callback: (payload: T) => any) {
		if (!this.#callbacks.includes(callback)) {
			this.#callbacks.push(callback)
		}
	}

	public remove(callback: (payload: T) => any) {
		const index = this.#callbacks.findIndex((x) => x === callback)
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
