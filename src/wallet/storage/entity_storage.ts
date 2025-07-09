import { storage, type StorageArea, StorageType } from ".";

export class EntityStorage<T> {
    private readonly storage: StorageArea;
    private readonly root: string;

    constructor(root: string, type: StorageType = StorageType.Local) {
        this.root = root;
        this.storage = type === StorageType.Local ? storage.local : storage.session;
    }

    public async getVersion(): Promise<number> {
        const res = await this.storage.get(this.root);
        return this.root in res ? JSON.parse(res[this.root]) : 0;
    }

    public setVersion(version: number): Promise<void> {
        return this.storage.set({[this.root]: JSON.stringify(version)});
    }

    public async contains(id: string): Promise<boolean> {
        const key = `${this.root}@${id}`;
        const res = await this.storage.get(key);
        return key in res;
    }

    public async get(id: string): Promise<T | undefined> {
        const key = `${this.root}@${id}`;
        const res = await this.storage.get(key);
        if (key in res) {
            return JSON.parse(res[key]);
        }
        return undefined;
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

    public async getKeys(): Promise<Array<string>> {
        const path = `${this.root}@`;
        const res = await this.storage.get();
        return Object.keys(res)
            .filter(k => k.startsWith(path))
            .map(k => k.substring(path.length));
    }

    public async getValues(): Promise<Array<T>> {
        const path = `${this.root}@`;
        const res = await this.storage.get();
        return Object.entries(res)
            .filter(([k, _]) => k.startsWith(path))
            .map(([_, v]) => JSON.parse(v));
    }

    public async findByPredicate(predicate: (entity: T) => boolean): Promise<Array<{ key: string, entity: T }>> {
        const allEntities = await this.getAll()
        const foundEntities = allEntities
            .filter(([, entity]) => predicate(entity))
            .map(([key, entity]) => ({ key, entity }))

        return foundEntities
    }
}