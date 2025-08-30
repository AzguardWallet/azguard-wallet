import { storage, type StorageArea, StorageType } from ".";

export class ValueStorage<T> {
    private readonly storage: StorageArea;
    private readonly root: string;

    constructor(root: string, type: StorageType = StorageType.Local) {
        this.root = root;
        this.storage = type === StorageType.Local ? storage.local : storage.session;
    }

    public async get(): Promise<T | undefined> {
        const res = await this.storage.get(this.root);
        if (this.root in res) {
            return JSON.parse(res[this.root]);
        }
        return undefined;
    }

    public set(value: T): Promise<void> {
        return this.storage.set({[this.root]: JSON.stringify(value)});
    }

    public delete(): Promise<void> {
        return this.storage.remove(this.root);
    }
}
