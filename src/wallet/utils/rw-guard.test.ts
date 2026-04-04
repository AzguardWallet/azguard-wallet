import { describe, test, expect } from "vitest";
import { ReadWriteGuard } from "./rw-guard";

/** Creates a deferred promise for controlling async timing in tests. */
function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** Flush all pending microtasks by waiting for a macrotask. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("ReadWriteGuard", () => {
    test("concurrent reads: two reads proceed simultaneously", async () => {
        const guard = new ReadWriteGuard();
        const order: string[] = [];

        const d1 = deferred();
        const d2 = deferred();

        const r1 = guard.read(async () => {
            order.push("r1:start");
            await d1.promise;
            order.push("r1:end");
            return "a";
        });
        const r2 = guard.read(async () => {
            order.push("r2:start");
            await d2.promise;
            order.push("r2:end");
            return "b";
        });

        // Both reads started before either resolved
        expect(order).toEqual(["r1:start", "r2:start"]);

        d2.resolve();
        d1.resolve();
        const [v1, v2] = await Promise.all([r1, r2]);

        expect(v1).toBe("a");
        expect(v2).toBe("b");
        expect(order).toContain("r1:end");
        expect(order).toContain("r2:end");
    });

    test("serialized writes: second write waits for first", async () => {
        const guard = new ReadWriteGuard();
        const order: string[] = [];
        const d1 = deferred();

        const w1 = guard.write(async () => {
            order.push("w1:start");
            await d1.promise;
            order.push("w1:end");
        });

        await flush();
        expect(order).toContain("w1:start");

        const w2 = guard.write(async () => {
            order.push("w2:start");
        });

        await flush();
        // w2 should NOT have started while w1 holds the lock
        expect(order).not.toContain("w2:start");

        d1.resolve();
        await Promise.all([w1, w2]);
        expect(order).toEqual(["w1:start", "w1:end", "w2:start"]);
    });

    test("reads bypass write lock: read completes while write holds lock", async () => {
        const guard = new ReadWriteGuard();
        const order: string[] = [];
        const dWrite = deferred();

        const w = guard.write(async () => {
            order.push("w:start");
            await dWrite.promise;
            order.push("w:end");
        });

        await flush();
        expect(order).toEqual(["w:start"]);

        // Read should proceed immediately even though write holds the lock
        const readResult = await guard.read(async () => {
            order.push("r:done");
            return 42;
        });

        expect(readResult).toBe(42);
        expect(order).toEqual(["w:start", "r:done"]);

        dWrite.resolve();
        await w;
        expect(order).toEqual(["w:start", "r:done", "w:end"]);
    });

    test("enterWrite blocks subsequent writes", async () => {
        const guard = new ReadWriteGuard();
        const order: string[] = [];

        await guard.enterWrite();
        order.push("lock:held");

        const w = guard.write(async () => {
            order.push("w:start");
        });

        await flush();
        expect(order).toEqual(["lock:held"]);

        guard.leaveWrite();
        await w;
        expect(order).toEqual(["lock:held", "w:start"]);
    });

    test("leaveWrite unblocks queued writes", async () => {
        const guard = new ReadWriteGuard();
        let writeRan = false;

        await guard.enterWrite();
        const w = guard.write(async () => {
            writeRan = true;
        });

        await flush();
        expect(writeRan).toBe(false);

        guard.leaveWrite();
        await w;
        expect(writeRan).toBe(true);
    });

    test("read returns fn result, write returns fn result", async () => {
        const guard = new ReadWriteGuard();

        const readResult = await guard.read(async () => "read-value");
        expect(readResult).toBe("read-value");

        const writeResult = await guard.write(async () => 123);
        expect(writeResult).toBe(123);
    });
});
