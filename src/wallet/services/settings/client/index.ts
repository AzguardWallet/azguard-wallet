import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LogLevel, LoggerServiceClient } from "@/wallet/services/logger/client";
import { SettingServiceEvent, type SettingServiceEventMessage } from "./events";
import type { Setting, SettingValue } from "./models";
import {
    GetSettingsRequest,
    GetSettingRequest,
    UpdateSettingRequest,
} from "./methods";

export * from './events';
export * from './methods';
export * from './models';

export const SETTING_SERVICE_NAME = "setting";

/**
 * Client for interaction with the SettingService via messaging API
 */
export class SettingServiceClient extends ServiceClient {
    /**
     * Creates SettingServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onSettingUpdated Callback, called when an existing setting was updated.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onSettingUpdated?: (setting: Setting) => void,
    ) {
        super(SETTING_SERVICE_NAME, new LoggerServiceClient, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case SettingServiceEvent.SettingUpdated:
                if (this.onSettingUpdated) {
                    try {this.onSettingUpdated((message as SettingServiceEventMessage).setting);}
                    catch {}
                }
                break;
            default:
                this.log(LogLevel.Error, `Unexpected event type ${message.event}.`)
                break;
        }
    }

    /**
     * Returns a list of settings.
     * @param includeFullKey If 'true', a setting key will look like {group}:{parameter}, otherwise {parameter}
     */
    public getSettings(includeFullKey = false): Promise<Setting[]> {
        return this.request(new GetSettingsRequest(includeFullKey));
    }

    /**
     * Returns a setting with the specified key.
     * @param key Setting key.
     * @throws If the setting with the specified key doesn't exist.
     */
    public getSetting(key: string): Promise<Setting> {
        return this.request(new GetSettingRequest(key));
    }

    /**
     * Updates a setting with the specified key.
     * @param key Setting key.
     * @param value Setting new value.
     * @throws If an error occurs when updating a setting.
     */
    public updateSetting(key: string, value: SettingValue): Promise<Setting> {
        return this.request(new UpdateSettingRequest(key, value));
    }
}
