import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { type Setting, type SettingValue, SETTING_SERVICE_NAME } from ".";

export enum SettingServiceMethod {
    GetSettings,
    GetSetting,
    ResetSettings,
    UpdateSetting,
}

export class GetSettingsRequest extends RequestMessage {
    constructor() {
        super(SETTING_SERVICE_NAME, SettingServiceMethod.GetSettings);
    }
}

export class GetSettingsResponse extends ResponseMessage {
    constructor(
        request: GetSettingsRequest,
        result?: Setting[],
        error?: string,
    ) {
        super(SETTING_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetSettingRequest extends RequestMessage {
    constructor(
        public readonly key: string,
    ) {
        super(SETTING_SERVICE_NAME, SettingServiceMethod.GetSetting);
    }
}

export class GetSettingResponse extends ResponseMessage {
    constructor(
        request: GetSettingRequest,
        result?: Setting,
        error?: string,
    ) {
        super(SETTING_SERVICE_NAME, request.requestId, result, error);
    }
}

export class ResetSettingsRequest extends RequestMessage {
    constructor() {
        super(SETTING_SERVICE_NAME, SettingServiceMethod.ResetSettings);
    }
}

export class ResetSettingsResponse extends ResponseMessage {
    constructor(
        request: ResetSettingsRequest,
        error?: string,
    ) {
        super(SETTING_SERVICE_NAME, request.requestId, error);
    }
}

export class UpdateSettingRequest extends RequestMessage {
    constructor(
        public readonly key: string,
        public readonly value: SettingValue,
    ) {
        super(SETTING_SERVICE_NAME, SettingServiceMethod.UpdateSetting);
    }
}

export class UpdateSettingResponse extends ResponseMessage {
    constructor(
        request: UpdateSettingRequest,
        error?: string,
    ) {
        super(SETTING_SERVICE_NAME, request.requestId, error);
    }
}
