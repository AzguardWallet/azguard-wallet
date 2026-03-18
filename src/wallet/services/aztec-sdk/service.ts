import {
    BackgroundConnectionHandler,
    MessageOrigin,
    type ActiveSession,
    type PendingDiscovery,
} from "@aztec/wallet-sdk/extension/handlers";
import type { BatchedMethod } from "@aztec/aztec.js/wallet";
import type { WalletMessage } from "@aztec/wallet-sdk/types";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import {
    DappInteractionService,
    type ConnectionParams,
    type OperationRequest,
} from "@/wallet/services/dapp-interaction/service";
import { DappSessionService, type DappSession } from "@/wallet/services/dapp-session/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getErrorMessage } from "@/wallet/utils/errors";
import { AZTEC_SDK_SERVICE_NAME, type Methods, type Events } from "./spec";
import { AppCapabilitiesSchema, type AppCapabilities, type WalletCapabilities } from "@aztec/aztec.js/wallet";
import type { WalletResponse } from "@aztec/wallet-sdk/types";
import type { OperationResult } from "@/wallet/services/execution/models";
import { jsonSanitize } from "@/wallet/utils/serialization";
import {
    resolveChainId,
    walletMessageToOperationRequest,
    capabilitiesToPermissions,
    BASE_METHODS,
} from "./adapter";

const WALLET_ID = "azguard-wallet";
const WALLET_NAME = "Azguard Wallet";
const WALLET_VERSION = __VERSION__;

function operationResultToResponse(
    messageId: string,
    result: OperationResult,
    walletId: string,
): WalletResponse {
    if (result.status === "ok") {
        return {
            messageId,
            result: jsonSanitize(result.result),
            walletId,
        };
    }
    return {
        messageId,
        error: result.status === "failed" ? result.error : "Operation skipped",
        walletId,
    };
}

type ConnectedApp = {
    id: string;
    origin: string;
    chainId: number;
    dappSessionId: string;
    connectedAt: number;
    /** If true, auto-approve discovery without showing popup */
    autoApprove: boolean;
};

export class AztecSdkService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = AZTEC_SDK_SERVICE_NAME;

    private handler!: BackgroundConnectionHandler;

    private dappInteractionService: DappInteractionService = null!;
    private dappSessionService: DappSessionService = null!;

    /** Maps SDK session IDs to DappSession IDs */
    private readonly sdkSessionToDappSession = new Map<string, string>();

    /** Tracks SDK-connected apps for session reuse and cleanup */
    private readonly connectedApps = new EntityStorage<ConnectedApp>(
        "azguard:core:aztecSdkConnectedApps",
        StorageType.Local,
    );

    public constructor(logger: ILogger) {
        super(AZTEC_SDK_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.dappInteractionService = services.get(DappInteractionService.name);
        this.dappSessionService = services.get(DappSessionService.name);

        // Clean up connected apps when their DappSession is deleted
        this.dappSessionService.onDappSessionDeleted.add(this.onDappSessionDeleted);

        this.handler = new BackgroundConnectionHandler(
            {
                walletId: WALLET_ID,
                walletName: WALLET_NAME,
                walletVersion: WALLET_VERSION,
                walletIcon: chrome.runtime.getURL("src/assets/images/azguard-icon-32.png"),
            },
            {
                sendToTab: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
                addContentListener: listener => {
                    // Only forward SDK protocol messages (origin === 'content-script') to the external handler.
                    // Internal Azguard messages (offscreen RPC, service-client traffic) must not reach SDK code.
                    chrome.runtime.onMessage.addListener((message, sender) => {
                        if (message?.origin === MessageOrigin.CONTENT_SCRIPT) {
                            listener(message, sender);
                        }
                        return undefined;
                    });
                },
            },
            {
                onPendingDiscovery: this.onPendingDiscovery,
                onSessionEstablished: this.onSessionEstablished,
                onSessionTerminated: this.onSessionTerminated,
                onWalletMessage: this.onWalletMessage,
            },
        );

        this.handler.initialize();

        // Clean up sessions when tabs are closed or navigated
        chrome.tabs.onRemoved.addListener(this.onTabRemoved);
        chrome.tabs.onUpdated.addListener(this.onTabUpdated);

        this.logInfo("Aztec SDK handler initialized");
    }

    private readonly onPendingDiscovery = async (discovery: PendingDiscovery) => {
        this.logInfo("SDK discovery request", discovery);

        try {
            const chainId = resolveChainId(discovery.chainInfo);

            // Check if this app has connected before
            const appKey = this.getConnectedAppKey(discovery.appId, discovery.origin, chainId);
            const existing = await this.connectedApps.get(appKey);

            if (existing) {
                const session = await this.dappSessionService.tryGetDappSession(existing.dappSessionId);
                if (session && existing.autoApprove) {
                    // Auto-approve: reuse existing DappSession
                    this.logInfo("Auto-approving connected app", { appId: discovery.appId });
                    this.sdkSessionToDappSession.set(discovery.requestId, session.id);
                    this.handler.approveDiscovery(discovery.requestId);
                    return;
                }
                // Session expired/invalid or not auto-approved — clean up old entry and session
                this.logInfo("Cleaning up previous SDK session", { appId: discovery.appId });
                await this.connectedApps.delete(appKey);
                if (session) {
                    await this.dappSessionService.deleteDappSession(session.id);
                }
            }

            // Show approval popup via DappInteractionService.
            //
            // SDK sessions are created with empty accounts. Account selection is deferred
            // to `requestCapabilities` (getAccounts capability) so the user isn't asked twice.
            // The connect popup for SDK sources hides the account picker — discovery serves
            // only as a trust gate ("approve this dApp?") + grants BASE_METHODS.
            //
            // This means `getAccounts` via the SDK requires a prior `requestCapabilities` call
            // to populate DappSession.accounts. Without it, getAccounts returns nothing.
            const connectionParams: ConnectionParams = {
                dappMetadata: {
                    name: discovery.appName ?? discovery.origin,
                    url: discovery.origin,
                },
                requiredPermissions: [
                    {
                        chains: [`aztec:${chainId}`],
                        methods: BASE_METHODS,
                    },
                ],
                source: "sdk",
            };

            const result = await this.dappInteractionService.connect(connectionParams);

            // Store SDK session → DappSession mapping
            this.sdkSessionToDappSession.set(discovery.requestId, result.id);
            this.handler.approveDiscovery(discovery.requestId);

            // Always track the session for cleanup; autoApprove controls reconnect behavior
            await this.connectedApps.set(appKey, {
                id: discovery.appId,
                origin: discovery.origin,
                chainId,
                dappSessionId: result.id,
                connectedAt: Date.now(),
                autoApprove: result.remember ?? false,
            });
            this.logInfo("App session stored", {
                appId: discovery.appId,
                dappSessionId: result.id,
                autoApprove: result.remember ?? false,
            });
        } catch (error) {
            this.logError("SDK discovery approval failed", getErrorMessage(error));
            this.handler.rejectDiscovery(discovery.requestId);
        }
    };

    private readonly onSessionEstablished = (session: ActiveSession) => {
        this.logInfo("SDK session established", {
            sessionId: session.sessionId,
            appId: session.appId,
            hasDappSession: this.sdkSessionToDappSession.has(session.sessionId),
        });
    };

    private readonly onSessionTerminated = (sessionId: string) => {
        this.logInfo("SDK session terminated", { sessionId });
        this.sdkSessionToDappSession.delete(sessionId);
    };

    private readonly onWalletMessage = async (session: ActiveSession, message: WalletMessage) => {
        this.logDebug("SDK wallet message", message);

        try {
            const dappSessionId = this.findDappSessionId(session);
            const chainId = resolveChainId(session.chainInfo);

            if (message.type === "requestCapabilities") {
                await this.handleRequestCapabilities(session, message, chainId, dappSessionId);
                return;
            }

            if (message.type === "batch") {
                await this.handleBatch(session, message, chainId, dappSessionId);
            } else {
                const operation = walletMessageToOperationRequest(message, chainId);
                const results = await this.dappInteractionService.execute({
                    sessionId: dappSessionId,
                    operations: [operation],
                });
                const response = operationResultToResponse(message.messageId, results[0], WALLET_ID);
                await this.handler.sendResponse(session.sessionId, response);
                this.logDebug("SDK response sent", { type: message.type, result: results[0] });
            }
        } catch (error) {
            this.logError("SDK message handling failed", getErrorMessage(error));
            await this.handler.sendResponse(session.sessionId, {
                messageId: message.messageId,
                error: getErrorMessage(error),
                walletId: WALLET_ID,
            });
        }
    };

    /**
     * Handles a requestCapabilities WalletMessage by showing the capabilities
     * approval popup and returning the granted capabilities to the SDK.
     */
    private async handleRequestCapabilities(
        session: ActiveSession,
        message: WalletMessage,
        chainId: number,
        dappSessionId: string,
    ) {
        const parsed = AppCapabilitiesSchema.safeParse(message.args[0]);
        if (!parsed.success) {
            throw new Error(`Invalid capabilities manifest: ${parsed.error.message}`);
        }
        const manifest = parsed.data as AppCapabilities;
        this.logInfo("SDK requestCapabilities", { manifest });

        const result = await this.dappInteractionService.requestCapabilities(dappSessionId, manifest, chainId, session.verificationHash);

        const walletCapabilities: WalletCapabilities = {
            version: "1.0",
            granted: result.granted,
            wallet: { name: WALLET_NAME, version: WALLET_VERSION },
        };

        await this.handler.sendResponse(session.sessionId, {
            messageId: message.messageId,
            result: walletCapabilities,
            walletId: WALLET_ID,
        });
        this.logDebug("SDK requestCapabilities response sent", { granted: result.granted.length });
    }

    /**
     * Handles a batch WalletMessage by extracting sub-methods, converting each
     * to an OperationRequest, executing them through DappInteractionService,
     * and assembling a batch response.
     */
    private async handleBatch(
        session: ActiveSession,
        message: WalletMessage,
        chainId: number,
        dappSessionId: string,
    ) {
        const methods = message.args[0] as BatchedMethod[];
        this.logDebug("SDK batch", { count: methods.length, methods: methods.map(m => m.name) });

        // Convert each batched method to an OperationRequest
        const operations: OperationRequest[] = methods.map(method => {
            const subMessage = {
                ...message,
                type: method.name,
                args: method.args,
            } as WalletMessage;
            return walletMessageToOperationRequest(subMessage, chainId);
        });

        // Execute all operations through DappInteractionService
        const results = await this.dappInteractionService.execute({
            sessionId: dappSessionId,
            operations,
        });

        // Assemble batch response: array of { name, result } per BatchedResultSchema.
        // TODO: Return per-operation errors instead of throwing on first failure.
        // The SDK's BatchedResultSchema supports per-item results, so we could return
        // partial successes. Currently, one failure aborts the entire batch.
        const batchResults = methods.map((method, i) => {
            const r = results[i];
            if (r.status !== "ok") {
                throw new Error(r.status === "failed" ? r.error : `Operation ${method.name} skipped`);
            }
            return { name: method.name, result: r.result };
        });

        const response = operationResultToResponse(
            message.messageId,
            { status: "ok", result: batchResults },
            WALLET_ID,
        );
        await this.handler.sendResponse(session.sessionId, response);
        this.logDebug("SDK batch response sent", { count: batchResults.length });
    }

    /** Finds the DappSession ID for the given SDK session. */
    private findDappSessionId(session: ActiveSession): string {
        const dappSessionId = this.sdkSessionToDappSession.get(session.sessionId);
        if (dappSessionId) {
            return dappSessionId;
        }
        throw new Error("No active DappSession for this SDK session");
    }

    private getConnectedAppKey(appId: string, origin: string, chainId: number): string {
        return JSON.stringify([appId, origin, chainId]);
    }

    private readonly onDappSessionDeleted = async (session: DappSession) => {
        // Clean up connected apps that reference the deleted DappSession
        const apps = await this.connectedApps.getValues();
        for (const app of apps) {
            if (app.dappSessionId === session.id) {
                const key = this.getConnectedAppKey(app.id, app.origin, app.chainId);
                await this.connectedApps.delete(key);
                this.logInfo("Removed connected app for deleted DappSession", {
                    appId: app.id,
                    dappSessionId: session.id,
                });
            }
        }

        // Terminate SDK sessions linked to this DappSession so dApps get a proper disconnect
        for (const [sdkSessionId, dappSessionId] of this.sdkSessionToDappSession) {
            if (dappSessionId === session.id) {
                this.handler.terminateSession(sdkSessionId);
                // onSessionTerminated callback will delete from sdkSessionToDappSession
            }
        }
    };

    private readonly onTabRemoved = (tabId: number) => {
        this.handler.terminateForTab(tabId);
    };

    private readonly onTabUpdated = (tabId: number, changeInfo: { status?: string; url?: string }) => {
        // Only terminate sessions when the tab navigates to a different origin.
        // SPA navigations (e.g. Next.js router.push) fire tabs.onUpdated with
        // status "loading" but stay on the same origin — these must NOT kill
        // the SDK session.
        if (changeInfo.status === "loading" && changeInfo.url) {
            try {
                const newOrigin = new URL(changeInfo.url).origin;
                const sessions = this.handler.getActiveSessions().filter(s => s.tabId === tabId);
                for (const session of sessions) {
                    if (session.origin !== newOrigin) {
                        this.handler.terminateSession(session.sessionId);
                    }
                }
            } catch (error) {
                this.logError("onTabUpdated: failed to parse URL, terminating sessions for tab", { tabId, url: changeInfo.url, error: String(error) });
                this.handler.terminateForTab(tabId);
            }
        }
    };
}
