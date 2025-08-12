export const array_equals = (arr1: Uint8Array<ArrayBuffer>, arr2: Uint8Array<ArrayBuffer>): boolean => {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}

export const array_max = (arr: Array<number>): number => {
    let res = 0;
    for (const x of arr) {
        if (x > res) {
            res = x;
        }
    }
    return res;
}

export class CircularBuffer<T> {
	private buffer: T[];
	private pointer = 0;
	private full = false;

	constructor(
        private capacity: number,
    ) {
        this.buffer = Array<T>(capacity).fill(undefined as T);
	}

	add(item: T): void {
		this.buffer[this.pointer] = item;
		this.pointer = (this.pointer + 1) % this.capacity;
		if (this.pointer === 0) this.full = true;
	}

	get(): T[] {
		if (!this.full) {
			return this.buffer.slice(0, this.pointer);
		}
		return [...this.buffer.slice(this.pointer), ...this.buffer.slice(0, this.pointer)];
	}

	resize(newCapacity: number): void {
		const allItems = this.get().slice(-newCapacity);
		this.capacity = newCapacity;
        this.buffer = Array<T>(newCapacity).fill(undefined as T);
		this.pointer = 0;
		this.full = false;
		for (const item of allItems) {
			this.add(item);
		}
	}
}
