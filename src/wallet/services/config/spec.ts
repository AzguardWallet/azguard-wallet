import type { Config, ConfigKey, ConfigProp } from "@/wallet/config"

export const CONFIG_SERVICE_NAME = "config"

export type { Config, ConfigKey, ConfigProp }

export type Methods = {
	getProps(): ConfigProp[]
	getValue<TKey extends ConfigKey>(key: TKey): Config[TKey]
	setValue<TKey extends ConfigKey>(key: TKey, value: Config[TKey]): void
	reset(): void
}

export type Events = {
	onUpdate: ConfigProp
}
