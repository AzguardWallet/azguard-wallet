/**
 * Wallet-SDK Background Integration
 *
 * Sets up the `BackgroundConnectionHandler` from `@aztec/wallet-sdk` in the
 * extension's service worker. This replaces the old `RpcService` + content
 * script proxy system with the standardized wallet-sdk discovery / key-exchange
 * / encrypted-channel protocol.
 *
 * ## How it works
 *
 * 1. **Discovery**: A dApp broadcasts a discovery request via postMessage.
 *    The content script forwards it to the background. We receive it via
 *    `onPendingDiscovery` and either auto-approve (returning user with valid
 *    session) or show a popup for user approval via `DappInteractionService`.
 *
 * 2. **Key Exchange**: After approval, the wallet-sdk performs ECDH P-256 key
 *    exchange to establish an AES-256-GCM encrypted channel.
 *
 * 3. **Wallet Messages**: Once connected, the dApp sends method calls (e.g.
 *    `sendTx`, `simulateTx`) encrypted over the channel. We decrypt them
 *    and route to `WalletSdkDispatcher` which delegates to `ExecutionService`.
 *
 * 4. **Responses**: Results are encrypted and sent back through the channel.
 */

import {
    BackgroundConnectionHandler,
    type PendingDiscovery,
    type ActiveSession,
} from "@aztec/wallet-sdk/extension/handlers";
import type { WalletMessage, WalletResponse } from "@aztec/wallet-sdk/types";

import type { ServiceCollection } from "@/wallet/base";
import { NetworkService } from "@/wallet/services/network/service";
import { AccountService } from "@/wallet/services/account/service";
import { ExecutionService } from "@/wallet/services/execution/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { DappInteractionService } from "@/wallet/services/dapp-interaction/service";
import type { DiscoveryParams } from "@/wallet/services/dapp-interaction/spec";
import { DappSessionService, AccessLevel } from "@/wallet/services/dapp-session/service";
import { WalletSdkDispatcher } from "./dispatcher";
import { DiscoveryQueue } from "./discovery-queue";
import type { SessionContext } from "./types";
import type { ILogger } from "@/wallet/logger";
import { LogLevel } from "@/wallet/logger";
import { Fr } from "@aztec/foundation/curves/bn254";
import packageJson from "../../../../package.json";

/**
 * Initialize the wallet-sdk BackgroundConnectionHandler and wire it
 * to the extension's service layer.
 *
 * Call this after `services.start()` in the service worker entry point.
 */
export function initWalletSdkHandler(services: ServiceCollection, logger: ILogger): BackgroundConnectionHandler {
    const networkService: NetworkService = services.get(NetworkService.name);
    const accountService: AccountService = services.get(AccountService.name);
    const executionService: ExecutionService = services.get(ExecutionService.name);
    const profileService: ProfileService = services.get(ProfileService.name);
    const dappInteractionService: DappInteractionService = services.get(DappInteractionService.name);
    const dappSessionService: DappSessionService = services.get(DappSessionService.name);

    const dispatcher = new WalletSdkDispatcher(networkService, accountService, executionService, profileService, dappInteractionService, dappSessionService, logger);

    /** Track origins of new connections (user-approved via popup) to show verification after key exchange */
    const pendingVerification = new Set<string>();

    /**
     * Guard against concurrent discoveries for the same origin (prevents
     * duplicate connect popups). Stores a promise that resolves when the
     * connect popup completes, so duplicate discoveries wait for the session
     * to exist before being approved.
     */
    const pendingDiscoveryPromises = new Map<string, Promise<void>>();

    /**
     * Per-session message queue — ensures messages from the same dApp session
     * are processed sequentially (FIFO). Without this, the fire-and-forget
     * onWalletMessage callback processes messages concurrently, causing race
     * conditions (e.g. executeUtility runs before registerContract completes).
     */
    const sessionQueues = new Map<string, Promise<void>>();

    let discoveryQueue: DiscoveryQueue;

    const handler = new BackgroundConnectionHandler(
        {
            walletId: "vibeguard",
            walletName: "Vibeguard",
            walletVersion: packageJson.version,
            walletIcon: chrome.runtime.getURL("/src/assets/logo.png"),
        },
        {
            sendToTab: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
            addContentListener: (listener) => {
                chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender) => {
                    listener(message, sender);
                    return undefined;
                });
            },
        },
        {
            onPendingDiscovery: (discovery) => {
                handleDiscovery(discovery, handler, profileService, dappInteractionService, dappSessionService, pendingVerification, pendingDiscoveryPromises, discoveryQueue, logger);
            },

            onSessionEstablished: async (session) => {

                const dappSession = await dappSessionService.tryGetDappSessionByOrigin(session.origin);
                if (dappSession) {
                    await dappSessionService.setVerificationHash(dappSession.id, session.verificationHash);
                }

                const isNewConnection = pendingVerification.has(session.origin);
                if (isNewConnection) pendingVerification.delete(session.origin);

                const needsVerification = isNewConnection || (dappSession && !dappSession.trustedVerification);

                if (needsVerification && dappSession) {
                    chrome.windows.create({
                        type: "popup",
                        url: chrome.runtime.getURL(
                            `src/popup/index.html#/windows/verify?sessionId=${dappSession.id}&isReconnect=${!isNewConnection}`,
                        ),
                        height: 800,
                        width: 400,
                    });
                }
            },

            onSessionTerminated: (sessionId) => {
                sessionQueues.delete(sessionId);
                decryptQueues.delete(sessionId);
            },

            onWalletMessage: (session, message) => {
                const key = session.sessionId;
                const prev = sessionQueues.get(key) ?? Promise.resolve();
                const next = prev.then(() =>
                    handleWalletMessage(session, message, handler, dispatcher, profileService, logger),
                );
                sessionQueues.set(key, next.catch(() => {}));
            },
        },
    );

    discoveryQueue = new DiscoveryQueue(handler, logger);

    /**
     * Serialize decryption per-session to prevent message reordering.
     * The wallet-sdk uses `void this.handleEncryptedMessage(...)` (fire-and-forget),
     * so two messages can have their decryptions race.
     * TODO: Remove this monkey-patch if wallet-sdk adds a proper serialization API.
     */
    const origDecrypt = (handler as any).handleEncryptedMessage.bind(handler);
    const decryptQueues = new Map<string, Promise<void>>();
    (handler as any).handleEncryptedMessage = async function (sessionId: string, encrypted: unknown) {
        const prev = decryptQueues.get(sessionId) ?? Promise.resolve();
        const next = prev.then(() => origDecrypt(sessionId, encrypted));
        decryptQueues.set(sessionId, next.catch(() => {}));
        return next;
    };

    /** On unlock, drain any queued discovery requests */
    profileService.onActiveProfileChanged.add((profile) => {
        if (profile) {
            logger.log("wallet-sdk", LogLevel.Info, `Profile unlocked, draining discovery queue (${discoveryQueue.size} queued)`);
            discoveryQueue.drain(async (discovery) => {
                const p = await profileService.getActiveProfile();
                if (!p) {
                    logger.log("wallet-sdk", LogLevel.Warn, "Wallet locked mid-drain, stopping");
                    return false;
                }
                logger.log("wallet-sdk", LogLevel.Info, `Processing queued discovery: ${discovery.origin} (requestId: ${discovery.requestId})`);
                await handleDiscovery(discovery, handler, profileService, dappInteractionService, dappSessionService, pendingVerification, pendingDiscoveryPromises, discoveryQueue, logger);
                logger.log("wallet-sdk", LogLevel.Info, `Queued discovery processed: ${discovery.origin}`);
                return true;
            });
        } else {
            logger.log("wallet-sdk", LogLevel.Info, `Profile locked (${discoveryQueue.size} in queue)`);
        }
    });

    // Terminate sessions when a tab is closed
    chrome.tabs.onRemoved.addListener((tabId) => {
        handler.terminateForTab(tabId);
    });

    // Terminate sessions when a tab navigates to a different origin.
    // SPA navigations (e.g. Next.js router.push) fire tabs.onUpdated with
    // status "loading" but stay on the same origin — these must NOT kill
    // the session. (backport of upstream #56)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === "loading" && changeInfo.url) {
            try {
                const newOrigin = new URL(changeInfo.url).origin;
                const sessions = handler.getActiveSessions().filter(s => s.tabId === tabId);
                for (const session of sessions) {
                    if (session.origin !== newOrigin) {
                        logger.log("wallet-sdk", LogLevel.Info, `Tab ${tabId} navigated to ${newOrigin}, terminating session ${session.sessionId}`);
                        handler.terminateSession(session.sessionId);
                    }
                }
            } catch {
                handler.terminateForTab(tabId);
            }
        }
    });

    handler.initialize();
    logger.log("wallet-sdk", LogLevel.Info, "BackgroundConnectionHandler initialized");

    return handler;
}

/**
 * Handle a new discovery request from a dApp.
 *
 * Flow:
 * 1. Check if the wallet is unlocked (active profile exists)
 * 2. Check if a valid DappSession already exists for this origin (returning user)
 *    - If yes: auto-approve discovery without showing popup
 *    - If no: show connect popup via DappInteractionService
 * 3. On approval, the wallet-sdk proceeds with ECDH key exchange
 */
async function handleDiscovery(
    discovery: PendingDiscovery,
    handler: BackgroundConnectionHandler,
    profileService: ProfileService,
    dappInteractionService: DappInteractionService,
    dappSessionService: DappSessionService,
    pendingVerification: Set<string>,
    pendingDiscoveryPromises: Map<string, Promise<void>>,
    discoveryQueue: DiscoveryQueue,
    logger: ILogger,
): Promise<void> {
    try {
        const profile = await profileService.getActiveProfile();
        if (!profile) {
            discoveryQueue.enqueue(discovery.requestId, discovery.origin);
            return;
        }

        // Check for existing valid session (returning user → auto-approve)
        const existingSession = await dappSessionService.tryGetDappSessionByOrigin(discovery.origin);
        if (existingSession) {
            handler.approveDiscovery(discovery.requestId);
            logger.log("wallet-sdk", LogLevel.Info, `Discovery auto-approved (existing session): ${discovery.origin}`);
            return;
        }

        // Deduplicate: if a connect popup is already showing for this origin,
        // wait for it to complete (so the DappSession exists) then approve.
        // Without the wait, key exchange completes before the user approves
        // and the dApp sends messages (e.g. requestCapabilities) before the
        // DappSession is persisted.
        const pendingPopup = pendingDiscoveryPromises.get(discovery.origin);
        if (pendingPopup) {
            await pendingPopup;
            handler.approveDiscovery(discovery.requestId);
            logger.log("wallet-sdk", LogLevel.Info, `Discovery auto-approved (pending popup resolved): ${discovery.origin}`);
            return;
        }

        // New dApp → show discovery popup (Allow/Deny)
        const params: DiscoveryParams = {
            dappMetadata: {
                name: discovery.appName ?? discovery.appId,
                url: discovery.origin,
            },
        };

        // Store a promise that resolves when the popup completes so duplicate
        // discoveries can await it.
        let resolvePopup: () => void;
        const popupPromise = new Promise<void>(r => { resolvePopup = r; });
        pendingDiscoveryPromises.set(discovery.origin, popupPromise);

        try {
            const result = await dappInteractionService.discover(params, discovery.requestId);
            if (!result.approved) {
                handler.rejectDiscovery(discovery.requestId);
                logger.log("wallet-sdk", LogLevel.Info, `Discovery denied: ${discovery.origin}`);
                return;
            }

            // User approved — create a DappSession with empty accounts
            // Accounts will be shared later via getAccounts() authorization popup
            const chainId = chainInfoToChainId(discovery);
            const newSession = await dappSessionService.addDappSession(
                params.dappMetadata,
                [{ chains: [`aztec:${chainId}`], methods: [] }],
                [], // empty accounts — will be populated via getAccounts()
                AccessLevel.Transactions,
            );

            // Initialize with empty capability grants so enforceCapability()
            // blocks non-exempt methods until requestCapabilities() is called.
            await dappSessionService.setCapabilityGrants(newSession.id, []);

            pendingVerification.add(discovery.origin);
            handler.approveDiscovery(discovery.requestId);
            logger.log("wallet-sdk", LogLevel.Info, `Discovery approved: ${discovery.origin}`);
        } finally {
            resolvePopup!();
            pendingDiscoveryPromises.delete(discovery.origin);
        }
    } catch (error) {
        // User rejected or popup was closed
        handler.rejectDiscovery(discovery.requestId);
        logger.log("wallet-sdk", LogLevel.Warn, `Discovery rejected for ${discovery.origin}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Handle an incoming wallet message from a connected dApp.
 *
 * Dispatches the method call to the WalletSdkDispatcher, then encrypts
 * and sends the response back through the BackgroundConnectionHandler.
 */
async function handleWalletMessage(
    session: ActiveSession,
    message: WalletMessage,
    handler: BackgroundConnectionHandler,
    dispatcher: WalletSdkDispatcher,
    profileService: ProfileService,
    logger: ILogger,
): Promise<void> {
    const response: WalletResponse = {
        messageId: message.messageId,
        walletId: "vibeguard",
    };

    try {
        const profile = await profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet is locked");
        }

        const ctx: SessionContext = {
            chainId: chainInfoToChainId(session),
            profileId: profile.id,
            origin: session.origin,
            sessionId: session.sessionId,
        };

        const raw = await dispatcher.dispatch(message.type, message.args, ctx);
        response.result = toJsonSafe(raw);
    } catch (error) {
        response.error = error instanceof Error ? error.message : String(error);
        logger.log(
            "wallet-sdk",
            LogLevel.Error,
            `Method ${message.type} failed for ${session.origin}: ${response.error}`,
        );
    }

    try {
        await handler.sendResponse(session.sessionId, response);
    } catch (sendError) {
        logger.log(
            "wallet-sdk",
            LogLevel.Error,
            `Failed to send response for ${message.type}: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
        );
    }
}

/**
 * Recursively convert a value to a JSON-safe structure.
 *
 * JSON.stringify cannot handle BigInt (throws) and silently drops undefined.
 * PXE results are full of BigInt (Fr fields, addresses, etc). This function
 * converts BigInt → string and recurses through arrays/objects so the
 * wallet-sdk's plain JSON.stringify call succeeds.
 */
function toJsonSafe(value: unknown, seen = new WeakSet()): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "bigint") return value.toString();
    if (typeof value !== "object") return value;

    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);

    if (Array.isArray(value)) return value.map(v => toJsonSafe(v, seen));
    if (value instanceof Map) {
        return Array.from(value.entries(), ([k, v]) => [toJsonSafe(k, seen), toJsonSafe(v, seen)]);
    }
    if (value instanceof Set) {
        return Array.from(value, (v) => toJsonSafe(v, seen));
    }
    // Objects with a toJSON method (Fr, AztecAddress, etc.) — let JSON.stringify
    // call it naturally, but still recurse in case the result contains BigInts.
    const obj = value as Record<string, unknown>;
    if (typeof obj.toJSON === "function") {
        return toJsonSafe(obj.toJSON(), seen);
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
        out[key] = toJsonSafe(obj[key], seen);
    }
    return out;
}

/**
 * Extract numeric chain ID from ChainInfo or ActiveSession/PendingDiscovery.
 *
 * ChainInfo arrives as serialized JSON (hex strings) after passing through
 * postMessage + JSON.parse, not as Fr instances. We parse the hex strings
 * to numbers and XOR chainId with rollup version, matching the convention
 * used by NetworkService (chainId = l1ChainId ^ rollupVersion).
 */
function chainInfoToChainId(obj: { chainInfo: { chainId: Fr | string; version: Fr | string } }): number {
    const raw = obj.chainInfo;
    const chainId = typeof raw.chainId === "string" ? Number(BigInt(raw.chainId)) : Number(raw.chainId.toBigInt());
    const version = typeof raw.version === "string" ? Number(BigInt(raw.version)) : Number(raw.version.toBigInt());
    return (chainId ^ version) >>> 0;
}
