import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { CONFIG_SERVICE_NAME, Config, ConfigKey, ConfigProp, Events, Methods } from "./spec";

export * from "./spec";

export class ConfigServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onUpdate = new EventHandler<ConfigProp>();

    public constructor(name?: string) {
        super(CONFIG_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getProps(): Promise<ConfigProp[]> {
        return this.request("getProps");
    }

    public async getValue<TKey extends ConfigKey>(key: TKey): Promise<Config[TKey]> {
        return (await this.request("getValue", key)) as Config[TKey];
    }

    public setValue<TKey extends ConfigKey>(key: TKey, value: Config[TKey]): Promise<void> {
        return this.request("setValue", key, value);
    }

    public reset(): Promise<void> {
        return this.request("reset");
    }
}
