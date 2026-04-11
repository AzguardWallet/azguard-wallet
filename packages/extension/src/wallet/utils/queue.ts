export class Queue<TKey, TValue> {
	private readonly items: TValue[] = []
	private readonly keys: Set<TKey> = new Set()

	constructor(private readonly key: (item: TValue) => TKey) {}

	public get length(): number {
		return this.items.length
	}

	public clear() {
		this.items.splice(0, this.items.length)
		this.keys.clear()
	}

	public enqueue(item: TValue) {
		const key = this.key(item)
		if (this.keys.has(key)) {
			return
		}
		this.keys.add(key)
		this.items.push(item)
	}

	public priorityPass(item: TValue) {
		const key = this.key(item)
		if (this.keys.has(key)) {
			this.items.splice(
				this.items.findIndex((x) => this.key(x) === key),
				1,
			)
		} else {
			this.keys.add(key)
		}
		this.items.unshift(item)
	}

	public dequeue(): TValue | undefined {
		if (!this.items.length) {
			return undefined
		}
		const item = this.items.shift()!
		this.keys.delete(this.key(item))
		return item
	}

	public dequeueBatch(size: number): TValue[] {
		const res = []
		while (size-- > 0) {
			const item = this.dequeue()
			if (!item) break
			res.push(item)
		}
		return res
	}

	public peek(): TValue | undefined {
		return this.items.at(0)
	}
}
