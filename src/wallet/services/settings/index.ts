import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { ILogs } from "@/wallet/services/logger/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { Lock, } from "@/wallet/utils";
import {
    SETTING_SERVICE_NAME,
    Setting,
    type SettingValue,
    SettingServiceMethod,
    type GetSettingsRequest,
    GetSettingsResponse,
    type GetSettingRequest,
    GetSettingResponse,
    type ResetSettingsRequest,
    ResetSettingsResponse,
    type UpdateSettingRequest,
    UpdateSettingResponse,
    SettingServiceEvent,
    SettingServiceEventMessage,
} from "./client";
import { DEFAULT_SETTINGS, DEFAULT_SETTING_GROUPS } from "./defaults";

export class SettingService extends Service {
    public readonly onSettingUpdated: ((setting: Setting) => void)[] = [];

    private readonly storage: EntityStorage<SettingValue>;
    private initialized = false;
    private initPromise: Promise<void>;
    private readonly lock = new Lock();

    constructor(
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void,
    ) {
        super(SETTING_SERVICE_NAME, logger, emit);
        this.storage = new EntityStorage("azguard:settings", StorageType.Local);
        this.initPromise = this.initDefaultSettings();
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case SettingServiceMethod.GetSettings: {
                const _request = request as GetSettingsRequest;
                try {
                    const res = await this.getSettings(_request.includeFullKey);
                    return new GetSettingsResponse(_request, res);
                }
                catch (error: any) {
                    return new GetSettingsResponse(_request, undefined, error.message);
                }
            }
            case SettingServiceMethod.GetSetting: {
                const _request = request as GetSettingRequest;
                try {
                    const setting = await this.getSetting(_request.key);
                    return new GetSettingResponse(_request, setting);
                }
                catch (error: any) {
                    return new GetSettingResponse(_request, undefined, error.message);
                }
            }
            case SettingServiceMethod.ResetSettings: {
                const _request = request as ResetSettingsRequest;
                try {
                    await this.resetSettings();

                    return new ResetSettingsResponse(_request);
                }
                catch (error: any) {
                    return new ResetSettingsResponse(_request, error.message);
                }
            }
            case SettingServiceMethod.UpdateSetting: {
                const _request = request as UpdateSettingRequest;
                try {
                    await this.updateSetting(_request.key, _request.value);

                    return new UpdateSettingResponse(_request);
                }
                catch (error: any) {
                    return new UpdateSettingResponse(_request, error.message);
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    private getSettingId(key: string): string {
        const group = DEFAULT_SETTING_GROUPS[key];
        if (!group) {
            this.logError(`Unknown setting key: ${key}`);
            throw new Error(`Unknown setting key: ${key}`);
        }

        return `${group}:${key}`;
    }

    public async initDefaultSettings(): Promise<void> {
        for (const [group, settings] of Object.entries(DEFAULT_SETTINGS)) {
            for (const [key, value] of Object.entries(settings)) {
                const id = `${group}:${key}`;
                const exists = await this.storage.contains(id);
                if (!exists) {
                    await this.storage.set(id, value);
                }
                switch (key) {
                    case "ttl": {
                        const setting = new Setting(key, value);
                        for (const emit of this.onSettingUpdated) {
                            try {emit(setting)} catch {}
                        }
                        break;
                    }
                    case "debugMode": {
                        const value = await this.storage.get(id);
                        this.logger.setDebugMode(value as boolean);
                        break;
                    }
                
                    default:
                        break;
                }
            }
        }

        this.initialized = true;
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
        }
    }

    public async getSettings(includeFullKey = false): Promise<Setting[]> {
        await this.ensureInitialized();

        const all = await this.storage.getAll();
        return all.map(([fullKey, value]) => {
            const key = includeFullKey
                ? fullKey
                : fullKey.includes(":")
                    ? fullKey.slice(fullKey.indexOf(":") + 1)
                    : fullKey;
            return new Setting(key, value);
        });
    }

    public async getSetting(key: string): Promise<Setting> {
        await this.ensureInitialized();
        
        const value = await this.storage.get(this.getSettingId(key));
        if (value === undefined) {
            throw new Error("Unknown key");
        }

        return new Setting(key, value);
    }

    public async updateSetting(key: string, value: SettingValue) {
        await this.ensureInitialized();
        
        await this.lock.enter();

        try {
            const _setting = await this.getSetting(key);
            if (_setting?.value === value) return;

            const id = this.getSettingId(key);
            await this.storage.set(id, value)

            if (key === "debugMode") {
                this.logger.setDebugMode(value as boolean);
            }

            const setting = new Setting(key, value)
            this.emit(new SettingServiceEventMessage(
                SettingServiceEvent.SettingUpdated,
                setting
            ));
            for (const emit of this.onSettingUpdated) {
                try {emit(setting)} catch {}
            }
        } catch {
            this.logError(`Failed to update setting ${key} to ${value}`);
            throw new Error("Failed to update setting");
        } finally {
            this.lock.leave();
        }
    }

    public async resetSettings(): Promise<void> {
        await this.lock.enter();

        try {
            const keys = await this.storage.getKeys();
            for (const key of keys) {
                await this.storage.delete(key);
            }

            for (const [group, entries] of Object.entries(DEFAULT_SETTINGS)) {
                for (const [key, value] of Object.entries(entries)) {
                    const id = `${group}:${key}`;
                    await this.storage.set(id, value);

                    const setting = new Setting(key, value);
                    this.emit(new SettingServiceEventMessage(
                        SettingServiceEvent.SettingUpdated,
                        setting
                    ));
                    for (const emit of this.onSettingUpdated) {
                        try {emit(setting)} catch {}
                    }
                }
            }
        } catch (err) {
            this.logError(["Failed to reset settings", err]);
            throw new Error("Failed to reset settings");
        } finally {
            this.lock.leave();
        }
    }
}
