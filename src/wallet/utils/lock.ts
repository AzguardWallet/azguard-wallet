export class Lock {
	private readonly queue: ((value: void) => void)[] = [];
	private locked: boolean = false;

	public async enter() {
		return new Promise((resolve, _) => {
			this.queue.push(resolve);
			this.dispatch();
		});
	}

	public leave() {
		this.locked = false;
		this.dispatch();
	}

	private dispatch() {
		if (!this.locked && this.queue.length) {
			this.locked = true;
			this.queue.shift()!();
		}
	}
}
