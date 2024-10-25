import { storage, StorageArea, StorageType } from ".";

export class EntityStorage<T> {
    private readonly storage: StorageArea;
    private readonly root: string;

    constructor(root: string, type: StorageType = StorageType.Local) {
        this.root = root;
        this.storage = type === StorageType.Local ? storage.local : storage.session;
    }

    public async contains(id: string): Promise<boolean> {
        const key = `${this.root}@${id}`;
        const res = await this.storage.get(key);
        return key in res;
    }

    public async get(id: string): Promise<T | null> {
        const key = `${this.root}@${id}`;
        var res = await this.storage.get(key);
        if (key in res) {
            return JSON.parse(res[key]);
        }
        return null;
    }

    public set(id: string, entity: T): Promise<void> {
        return this.storage.set({[`${this.root}@${id}`]: JSON.stringify(entity)});
    }

    public delete(id: string): Promise<void> {
        return this.storage.remove(`${this.root}@${id}`);
    }

    public async getAll(): Promise<Array<[string, T]>> {
        const path = `${this.root}@`;
        const res = await this.storage.get();
        return Object.entries(res)
            .filter(([k, _]) => k.startsWith(path))
            .map(([k, v]) => [k.substring(path.length), JSON.parse(v)]);
    }
}