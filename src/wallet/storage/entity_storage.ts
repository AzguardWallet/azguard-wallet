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

    public async get(id: string): Promise<T | undefined> {
        const key = `${this.root}@${id}`;
        var res = await this.storage.get(key);
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

    public async findByKeys(predicate: (entity: T) => boolean): Promise<{ key: string, entity: T } | undefined> {
        const allEntities = await this.getAll()
        const foundEntity = allEntities.find(([, entity]) => predicate(entity))

        if (foundEntity) {
            return { key: foundEntity[0], entity: foundEntity[1] }
        }

        return undefined
    }
}