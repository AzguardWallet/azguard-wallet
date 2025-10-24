export const PASSKEY_SERVICE_NAME = "passkey";
export const PASSKEY_PRF_LABEL = "azguard:profile:v1";
export const PASSKEY_TIMEOUT = 60_000 * 3;  // 3 minutes

export type PasskeyCredentialData = {
    id: string;  // base64
    prf: string;  // base64
    userHandle?: string;  // hex
};

export type PasskeyRequest =
    | {
        mode: "create";
        userHandle: string;
    }
    | {
        mode: "get";
        credentialId?: string;
    }

import type { PasskeyCredential } from "./credential";

export type PasskeyRequestPromise = {
    resolve: (r: PasskeyCredential) => void;
    reject: (reason: string) => void;
    request: PasskeyRequest;
};

export type Methods = {
    /**
     * Returns details for the pending request so the window can proceed.
     * @param requestId Pending request identifier.
     */
    getPendingRequest(requestId: string): PasskeyRequest;

    /**
     * Resolves a pending request, completing the promise.
     * @param requestId Pending request identifier.
     * @param result Credential data containing the credential id and PRF output (base64 strings).
     */
    resolvePasskeyRequest(requestId: string, result: PasskeyCredentialData): void;

    /**
     * Rejects a pending request with a reason.
     * @param requestId Pending request identifier.
     * @param reason Human-readable reason for rejection.
     */
    rejectPasskeyRequest(requestId: string, reason: string): void;
};
