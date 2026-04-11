import type { EventHandler } from "@/wallet/utils/event-handler"
import type { Config, ConfigKey, ConfigProp } from "./config"

export * from "./config"
export * from "./store"

export interface IConfig {
	onUpdate: EventHandler<ConfigProp>
	get<TKey extends ConfigKey>(key: TKey): Config[TKey]
}

export interface IConfigStore extends IConfig {
	props: ConfigProp[]
	set<TKey extends ConfigKey>(key: TKey, value: Config[TKey]): Promise<void>
	reset(): Promise<void>
}
