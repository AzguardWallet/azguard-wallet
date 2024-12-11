import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Profile, PROFILE_SERVICE_NAME } from ".";

export enum ProfileServiceMethod {
    GetActiveProfile,
    GetProfiles,
    CreateProfile,
    UnlockProfile,
    LockActiveProfile,
    RefreshSession,
    ChangeProfileName,
    ChangeProfilePassword,
    DeleteProfile,
    ImportEncrypted,
    ImportPlain,
    ExportEncrypted,
    ExportPlain,
}

export class GetActiveProfileRequest extends RequestMessage {
    constructor() {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.GetActiveProfile);
    }
}

export class GetActiveProfileResponse extends ResponseMessage {
    constructor(
        request: GetActiveProfileRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class GetProfilesRequest extends RequestMessage {
    constructor() {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.GetProfiles);
    }
}

export class GetProfilesResponse extends ResponseMessage {
    constructor(
        request: GetProfilesRequest,
        result?: Profile[],
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class CreateProfileRequest extends RequestMessage {
    constructor(
        public readonly name: string,
        public readonly password: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.CreateProfile);
    }
}

export class CreateProfileResponse extends ResponseMessage {
    constructor(
        request: CreateProfileRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class UnlockProfileRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly password: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.UnlockProfile);
    }
}

export class UnlockProfileResponse extends ResponseMessage {
    constructor(
        request: UnlockProfileRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class LockActiveProfileRequest extends RequestMessage {
    constructor() {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.LockActiveProfile);
    }
}

export class LockActiveProfileResponse extends ResponseMessage {
    constructor(
        request: LockActiveProfileRequest,
    ) {
        super(PROFILE_SERVICE_NAME, request.id);
    }
}

export class RefreshSessionRequest extends RequestMessage {
    constructor() {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.RefreshSession);
    }
}

export class RefreshSessionResponse extends ResponseMessage {
    constructor(
        request: RefreshSessionRequest,
    ) {
        super(PROFILE_SERVICE_NAME, request.id);
    }
}

export class ChangeProfileNameRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly name: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.ChangeProfileName);
    }
}

export class ChangeProfileNameResponse extends ResponseMessage {
    constructor(
        request: ChangeProfileNameRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class ChangeProfilePasswordRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly oldPassword: string,
        public readonly newPassword: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.ChangeProfilePassword);
    }
}

export class ChangeProfilePasswordResponse extends ResponseMessage {
    constructor(
        request: ChangeProfilePasswordRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class DeleteProfileRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.DeleteProfile);
    }
}

export class DeleteProfileResponse extends ResponseMessage {
    constructor(
        request: DeleteProfileRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class ImportEncryptedRequest extends RequestMessage {
    constructor(
        public readonly name: string,
        public readonly secret: string,
        public readonly password: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.ImportEncrypted);
    }
}

export class ImportEncryptedResponse extends ResponseMessage {
    constructor(
        request: ImportEncryptedRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class ImportPlainRequest extends RequestMessage {
    constructor(
        public readonly name: string,
        public readonly secret: string,
        public readonly password: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.ImportPlain);
    }
}

export class ImportPlainResponse extends ResponseMessage {
    constructor(
        request: ImportPlainRequest,
        result?: Profile,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class ExportEncryptedRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.ExportEncrypted);
    }
}

export class ExportEncryptedResponse extends ResponseMessage {
    constructor(
        request: ExportEncryptedRequest,
        result?: string,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}

export class ExportPlainRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly password: string,
    ) {
        super(PROFILE_SERVICE_NAME, ProfileServiceMethod.ExportPlain);
    }
}

export class ExportPlainResponse extends ResponseMessage {
    constructor(
        request: ExportPlainRequest,
        result?: string,
        error?: string,
    ) {
        super(PROFILE_SERVICE_NAME, request.id, result, error);
    }
}