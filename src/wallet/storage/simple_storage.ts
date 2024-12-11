import { storage, StorageArea, StorageType } from ".";

export class SimpleStorage<T> {
    private readonly storage: StorageArea;
    private readonly root: string;

    constructor(root: string, type: StorageType = StorageType.Local) {
        this.root = root;
        this.storage = type === StorageType.Local ? storage.local : storage.session;
    }
    
    public async get(key: string): Promise<T | undefined> {
        const path = `${this.root}:${key}`;
        var res = await this.storage.get(path);
        if (path in res) {
            return JSON.parse(res[path]);
        }
        return undefined;
    }

    public set(key: string, value: T): Promise<void> {
        const path = `${this.root}:${key}`;
        return this.storage.set({[path]: JSON.stringify(value)});
    }

    public delete(key: string): Promise<void> {
        const path = `${this.root}:${key}`;
        return this.storage.remove(path);
    }
}