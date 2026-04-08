import { StorageType, ValueStorage } from "@/wallet/storage"
import { Lock } from "@/wallet/utils"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type IConfigStore, Config, type ConfigProp, type ConfigKey } from "."

export class ConfigStore implements IConfigStore {
	public readonly onUpdate = new EventHandler<ConfigProp>()

	private readonly lock = new Lock()
	private readonly storage = new ValueStorage<Config>("azguard:config", StorageType.Local)
	private config = new Config()

	public get props(): ConfigProp[] {
		return Object.entries(this.config).map(([key, value]) => ({ key, value }) as ConfigProp)
	}

	public async load() {
		const storedConfig = await this.storage.get()
		if (storedConfig && typeof storedConfig === "object") {
			await this.apply(storedConfig)
		}
	}

	public get<TKey extends ConfigKey>(key: TKey): Config[TKey] {
		return this.config[key]
	}

	public async set<TKey extends ConfigKey>(key: TKey, value: Config[TKey]) {
		try {
			await this.lock.enter()
			if (this.config[key] === value) {
				return
			}
			this.config[key] = value
			this.onUpdate.invoke({ key, value } as ConfigProp)
			await this.storage.set(this.config)
		} finally {
			this.lock.leave()
		}
	}

	public async reset() {
		await this.apply(new Config())
	}

	private async apply(config: Config) {
		const src = config as unknown as Record<string, unknown>
		const dst = this.config as unknown as Record<string, unknown>
		for (const key of Object.keys(dst)) {
			if (key in src && typeof src[key] === typeof dst[key] && src[key] !== dst[key]) {
				dst[key] = src[key]
				this.onUpdate.invoke({ key, value: dst[key] } as ConfigProp)
			}
		}
		await this.storage.set(this.config)
	}
}
