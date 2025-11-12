import { ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { PASSKEY_SERVICE_NAME, Methods, PasskeyCredentialData, PasskeyRequest, PasskeyRequestPromise } from "./spec";
import { PasskeyCredential } from "./credential";
import { getRandomHex } from "@/wallet/utils";

export * from "./spec";

export class PasskeyService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = PASSKEY_SERVICE_NAME;

    private pending: Map<string, PasskeyRequestPromise> = new Map();

    public constructor(logger: ILogger) {
        super(PASSKEY_SERVICE_NAME, logger);
    }

    public async createKey(userHandle: string): Promise<PasskeyCredential> {
        return await this.openWindowAndWait({ mode: "create", userHandle });
    }

    public async getKey(credentialId?: string): Promise<PasskeyCredential> {
        return await this.openWindowAndWait({ mode: "get", credentialId });
    }

    public async getPendingRequest(requestId: string): Promise<PasskeyRequest> {
        const entry = this.pending.get(requestId);
        if (!entry) throw new Error("Invalid request id");
        return entry.request;
    }

    public async resolvePasskeyRequest(requestId: string, result: PasskeyCredentialData): Promise<void> {
        const entry = this.pending.get(requestId);
        if (!entry) throw new Error("Invalid request id");
        const credential = await PasskeyCredential.create(result);
        this.pending.delete(requestId);
        this.logDebug("Passkey request resolved: ", credential.id);
        entry.resolve(credential);
    }

    public async rejectPasskeyRequest(requestId: string, reason: string): Promise<void> {
        const entry = this.pending.get(requestId);
        if (!entry) throw new Error("Invalid request id");
        this.pending.delete(requestId);
        this.logInfo("Passkey request rejected: ", reason);
        entry.reject(reason);
    }

    private async openWindowAndWait(request: PasskeyRequest): Promise<PasskeyCredential> {
        let id: string;
        do {
            id = getRandomHex(8);
        } while (this.pending.has(id));
        const promise = new Promise<PasskeyCredential>((resolve, reject) => {
            this.pending.set(id, { resolve, reject, request });
        });

        chrome.windows.create(
            {
                type: "popup",
                url: chrome.runtime.getURL(`src/popup/index.html#/windows/passkey?requestId=${id}`),
                height: 800,
                width: 500,
            },
            createdWindow => {
                if (!createdWindow || createdWindow.id == null) return;

                const windowId = createdWindow.id;
                const pendingMap = this.pending;

                function onRemoved(closedWindowId: number) {
                    if (closedWindowId === windowId) {
                        (chrome.windows.onRemoved.removeListener as any)(onRemoved);

                        const entry = pendingMap.get(id);
                        if (entry) {
                            entry.reject("User closed the passkey window");
                            pendingMap.delete(id);
                        }
                    }
                }

                (chrome.windows.onRemoved.addListener as any)(onRemoved);
            },
        );

        return promise;
    }
}
