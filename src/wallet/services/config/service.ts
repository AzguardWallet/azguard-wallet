import { ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { IConfigStore } from "@/wallet/config";
import { ILogger } from "@/wallet/logger";
import { EventHandler } from "@/wallet/utils/event-handler";
import { CONFIG_SERVICE_NAME, Config, ConfigKey, ConfigProp, Events, Methods } from "./spec";

export * from "./spec";

export class ConfigService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = CONFIG_SERVICE_NAME;

    public readonly onUpdate = new EventHandler<ConfigProp>();

    private readonly config: IConfigStore;

    public constructor(configStore: IConfigStore, logger: ILogger) {
        super(CONFIG_SERVICE_NAME, logger);
        this.config = configStore;
        this.config.onUpdate.add(this.onConfigUpdated);
    }

    public async getProps(): Promise<ConfigProp[]> {
        return this.config.props;
    }

    public async getValue<TKey extends ConfigKey>(key: TKey): Promise<Config[TKey]> {
        return this.config.get(key);
    }

    public async setValue<TKey extends ConfigKey>(key: TKey, value: Config[TKey]): Promise<void> {
        await this.config.set(key, value);
    }

    public async reset(): Promise<void> {
        await this.config.reset();
    }

    private readonly onConfigUpdated = (prop: ConfigProp) => {
        this.emit("onUpdate", prop);
    };
}
