import { EventMessage } from "@/wallet/base/port-service/messages";
import { type Setting, SETTING_SERVICE_NAME } from ".";

export enum SettingServiceEvent {
    SettingUpdated,
}

export class SettingServiceEventMessage extends EventMessage {
    constructor(
        event: SettingServiceEvent,
        public readonly setting: Setting
    ) {
        super(SETTING_SERVICE_NAME, event);
    }
}
