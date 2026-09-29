import { Restored, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { Config as ConfigDefaults, IConfigStore } from "@/wallet/config";
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

    public async backup(): Promise<ConfigProp[]> {
        return await this.getProps();
    }

    /**
     * Config is wallet-global, not per-profile. An imported file must never silently
     * lower a privacy toggle (re-enabling outbound requests for every profile), and the
     * developer toggles describe this machine's session, not the profile in the file.
     */
    private static readonly nonRestorableKeys = new Set<string>([
        "stealthMode",
        "stealthModeSnapshot",
        "contractRegistry",
        "walletConnect",
        "uploadExternalImages",
        "externalLinks",
        "developerMode",
        "debugMode",
        "indicateFailures",
    ] satisfies ConfigKey[]);

    public async restore(configProps: ConfigProp[]): Promise<Restored<ConfigProp>[]> {
        const knownKeys = new Set(Object.keys(new ConfigDefaults()));
        const result: Restored<ConfigProp>[] = [];

        for (const cp of configProps) {
            if (!knownKeys.has(cp.key) || ConfigService.nonRestorableKeys.has(cp.key)) {
                continue;
            }
            try {
                await this.setValue(cp.key, cp.value);
                result.push(cp);
            } catch (err) {
                result.push({
                    ...cp,
                    restoreError: err instanceof Error ? err.message : err,
                });
            }
        }

        return result;
    }

    private readonly onConfigUpdated = (prop: ConfigProp) => {
        this.emit("onUpdate", prop);
    }
}
