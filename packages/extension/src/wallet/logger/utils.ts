import { type ILogger, type Log, LogLevel } from "."

export class DummyLogger implements ILogger {
	log() {}
}

export class CircularBuffer<T> {
	protected buffer: T[]
	protected position = 0
	protected full = false

	public constructor(protected capacity: number) {
		this.buffer = new Array<T>(capacity)
	}

	public items(): T[] {
		if (this.full) {
			return [...this.buffer.slice(this.position), ...this.buffer.slice(0, this.position)]
		}
		return this.buffer.slice(0, this.position)
	}

	public add(item: T): void {
		this.buffer[this.position] = item
		this.position = (this.position + 1) % this.capacity
		if (this.position === 0) {
			this.full = true
		}
	}

	public resize(newCapacity: number): void {
		if (newCapacity === this.capacity) {
			return
		}
		const items = this.items().slice(-newCapacity)
		this.clear(newCapacity)
		for (const item of items) {
			this.add(item)
		}
	}

	public clear(newCapacity?: number): void {
		this.capacity = newCapacity ?? this.capacity
		this.buffer = new Array<T>(this.capacity)
		this.position = 0
		this.full = false
	}
}

export class CircularBufferIterable<T extends { id: number }> extends CircularBuffer<T> {
	public get(count: number, fromId: number): T[] {
		const res: T[] = []
		const size = this.full ? this.capacity : this.position
		const start = this.full ? this.position : 0
		for (let i = 0, j = start; i < size; i++, j = (j + 1) % this.capacity) {
			if (this.buffer[j].id > fromId) {
				res.push(this.buffer[j])
				if (res.length === count) {
					break
				}
			}
		}
		return res
	}
}

const MAX_LOG_DATA_DEPTH = 6

export const trim = (value: unknown, depth: number = 0): unknown => {
	if (Array.isArray(value)) {
		if (depth === MAX_LOG_DATA_DEPTH) {
			return "[Array]"
		}
		return value.map((x) => trim(x, depth + 1))
	}
	if (value && typeof value === "object") {
		if (depth === MAX_LOG_DATA_DEPTH) {
			return "[Object]"
		}
		const obj = value as Record<string, unknown>
		if ("nonDispatchPublicFunctions" in value) {
			// ContractArtifact
			return { name: obj.name }
		}
		if ("packedBytecode" in value) {
			// ContractInstanceWithAddress
			return { id: obj.id }
		}
		if ("originalContractClassId" in value) {
			// ContractInstance
			return {
				currentContractClassId: obj.currentContractClassId,
				originalContractClassId: obj.originalContractClassId,
			}
		}
		return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [k, v]) => {
			switch (k) {
				case "acir":
				case "authWitnesses":
				case "partialWitness":
				case "publicInputs":
				case "vk":
					acc[k] = `[${k}]`
					break
				default:
					acc[k] = trim(v, depth + 1)
					break
			}
			return acc
		}, {})
	}
	return value
}

export const print = (log: Log) => {
	const date = new Date(log.timestamp)
	const time = `${date.toTimeString().slice(0, 8)}.${date.getMilliseconds().toString().padStart(3, "0")}`
	const ctx = log.context ? `${log.context}:` : ""
	const header = `[${time}] [${ctx}${log.source}]`

	switch (log.level) {
		case LogLevel.Debug:
			console._debug(header, ...log.data)
			break
		case LogLevel.Info:
			console._log(header, ...log.data)
			break
		case LogLevel.Warn:
			console._warn(header, ...log.data)
			break
		case LogLevel.Error:
			console._error(header, ...log.data)
			break
	}
}
