/**
 * WalletSdkDispatcher — Central dispatch layer for wallet-sdk protocol messages.
 *
 * ## Purpose
 *
 * This module bridges the `@aztec/wallet-sdk` communication protocol with the
 * extension's existing service layer. When a dApp sends a wallet method call
 * (e.g. `sendTx`, `simulateTx`, `registerToken`) over the wallet-sdk encrypted
 * channel, the BackgroundConnectionHandler decrypts it and delivers a
 * `WalletMessage` with `{ type: string, args: unknown[] }`.
 *
 * The dispatcher's job is to:
 *   1. Map the wallet-sdk method name to an internal `Operation` kind
 *   2. Resolve `SessionContext` (chainId, profileId) into concrete networkId / accountAddress
 *   3. Build the `Operation[]` array expected by `ExecutionService.executeOperations()`
 *   4. Return the result (or throw) so the caller can build a `WalletResponse`
 *
 * ## Architecture
 *
 * The dispatcher does NOT directly call PXE, account derivation, or transaction
 * building. It delegates everything to `ExecutionService`, which already handles
 * all operation kinds for both the Azguard custom interface and the Aztec.js
 * Wallet interface. This keeps business logic in one place.
 *
 * The session-to-network resolution mirrors `DappInteractionService.silentInteraction()`,
 * which converts CAIP-2 identifiers to internal network/account references.
 *
 * ## Usage
 *
 * ```typescript
 * const dispatcher = new WalletSdkDispatcher(networkService, accountService, executionService);
 *
 * // In BackgroundConnectionHandler.onWalletMessage callback:
 * const result = await dispatcher.dispatch(message.type, message.args, sessionContext);
 * await bgHandler.sendResponse(session.sessionId, {
 *     messageId: message.messageId,
 *     result,
 *     walletId: 'azguard',
 * });
 * ```
 */

import type { NetworkService, Network } from "@/wallet/services/network/service";
import type { AccountService, Account } from "@/wallet/services/account/service";
import type { ExecutionService, Operation, OperationResult } from "@/wallet/services/execution/service";
import type { ProfileService } from "@/wallet/services/profile/service";
import type { DappInteractionService, ExecutionResult } from "@/wallet/services/dapp-interaction/service";
import type { DappSessionService } from "@/wallet/services/dapp-session/service";
import { OriginType, type LocalTxOrigin } from "@/wallet/services/transaction/service";
import type { RejectedCapabilityRecord } from "@/wallet/services/dapp-session/spec";
import type { ILogger } from "@/wallet/logger";
import { LogLevel } from "@/wallet/logger";
import type { SessionContext } from "./types";
import { getRequiredCapability, isCapabilityExempt } from "./capability-map";
import packageJson from "../../../../package.json";

/**
 * Maps wallet-sdk method names to internal Operation kinds.
 *
 * The wallet-sdk ExtensionWallet proxy calls methods by their WalletSchema key name.
 * On the dApp side these are camelCase method names (e.g. `sendTx`, `simulateTx`).
 * We map each to the corresponding `Operation.kind` that `ExecutionService` understands.
 */
const METHOD_TO_KIND: Record<string, Operation["kind"]> = {
    // --- Standard Wallet interface (from @aztec/aztec.js/wallet WalletSchema) ---
    getChainInfo: "aztec_getChainInfo",
    getContractClassMetadata: "aztec_getContractClassMetadata",
    getContractMetadata: "aztec_getContractMetadata",
    getPrivateEvents: "aztec_getPrivateEvents",
    registerSender: "aztec_registerSender",
    getAddressBook: "aztec_getAddressBook",
    registerContract: "aztec_registerContract",
    simulateTx: "aztec_simulateTx",
    simulateUtility: "aztec_simulateUtility",
    profileTx: "aztec_profileTx",
    // sendTx is handled directly in dispatch() via DappInteractionService
    createAuthWit: "aztec_createAuthWit",
    // --- Azguard custom methods (added via schema_patch.ts) ---
    registerToken: "register_token",
    getCompleteAddress: "get_complete_address",
    simulateViews: "simulate_views",
};

/**
 * Operations that only need a network (no account context).
 * These map chainId → networkId.
 */
const NETWORK_ONLY_KINDS = new Set<Operation["kind"]>([
    "aztec_getChainInfo",
    "aztec_getContractClassMetadata",
    "aztec_getContractMetadata",
    "aztec_getPrivateEvents",
    "aztec_registerSender",
    "aztec_getAddressBook",
    "aztec_registerContract",
]);

/**
 * Operations that need both network AND account context.
 * These map chainId → networkId AND resolve the first session account.
 */
const ACCOUNT_KINDS = new Set<Operation["kind"]>([
    "aztec_simulateTx",
    "aztec_simulateUtility",
    "aztec_profileTx",
    "aztec_createAuthWit",
    "register_token",
    "get_complete_address",
    "simulate_views",
]);

// Note: sendTx is handled separately in handleSendTx() via DappInteractionService

export class WalletSdkDispatcher {
    constructor(
        private readonly networkService: NetworkService,
        private readonly accountService: AccountService,
        private readonly executionService: ExecutionService,
        private readonly profileService: ProfileService,
        private readonly dappInteractionService: DappInteractionService,
        private readonly dappSessionService: DappSessionService,
        private readonly logger: ILogger,
    ) {}

    /**
     * Dispatch a wallet-sdk method call to the execution layer.
     *
     * @param methodName - The wallet method name from `WalletMessage.type`
     *   (e.g. "sendTx", "registerToken", "getCompleteAddress")
     * @param args - The method arguments from `WalletMessage.args`
     * @param ctx - Session context with chainId, profileId, origin, sessionId
     * @returns The result value from the first (and only) operation
     * @throws If the method is unsupported, the operation fails, or session context is invalid
     */
    async dispatch(methodName: string, args: unknown[], ctx: SessionContext): Promise<unknown> {
        // Enforce capability grants before processing any method
        await this.enforceCapability(methodName, ctx);

        // Handle methods that don't go through ExecutionService
        if (methodName === "requestCapabilities") {
            return this.handleRequestCapabilities(args[0] as any, ctx);
        }
        if (methodName === "getAccounts") {
            return this.handleGetAccounts(ctx);
        }
        if (methodName === "batch") {
            return this.handleBatch(args[0] as any[], ctx);
        }

        // sendTx goes through DappInteractionService for the confirmation popup + fee selection
        if (methodName === "sendTx") {
            return this.handleSendTx(args, ctx);
        }

        const kind = METHOD_TO_KIND[methodName];
        if (!kind) {
            throw new Error(`Unsupported wallet method: ${methodName}`);
        }

        const operation = await this.buildOperation(kind, args, ctx);
        const origin: LocalTxOrigin = { type: OriginType.DAPP, name: ctx.origin };

        const results = await this.executionService.executeOperations([operation], origin);
        return this.unwrapResult(results[0]);
    }

    /**
     * Return accounts for the current session's profile and chain.
     * Scoped to session accounts only and uses per-app aliases.
     * WalletSchema expects: Array<{ alias: string, item: AztecAddress }>
     *
     * If the session has no accounts, returns empty array — the dApp should
     * call requestCapabilities() with an `accounts` type first.
     */
    private async handleGetAccounts(ctx: SessionContext): Promise<unknown> {
        const dappSession = await this.dappSessionService.tryGetDappSessionByOrigin(ctx.origin);
        if (!dappSession) {
            throw new Error(`No dApp session found for origin ${ctx.origin}`);
        }

        // No accounts yet — dApp should call requestCapabilities with accounts type first
        if (!dappSession.accounts || dappSession.accounts.length === 0) {
            return [];
        }

        // Return session-scoped accounts with per-app aliases
        const network = await this.resolveNetwork(ctx);
        const allAccounts = await this.accountService.getAccounts(ctx.profileId, network.chainId);
        const sessionAccountAddresses = this.getSessionAccountAddresses(dappSession, ctx.chainId);

        return allAccounts
            .filter(acc => sessionAccountAddresses.has(acc.address))
            .map(acc => {
                const caip = `aztec:${ctx.chainId}:${acc.address}`;
                const alias = dappSession.accountAliases?.[caip] ?? acc.name ?? "";
                return { alias, item: acc.address };
            });
    }

    /**
     * Handle batch: execute multiple method calls sequentially.
     * Each entry is { name: string, args: unknown[] }.
     * Returns array of { name: string, result: unknown }.
     *
     * Individual method failures do NOT abort the batch — each method gets
     * a SDK-compatible empty result so remaining methods still execute.
     *
     * The dApp-side SDK (aztec.js/batch_call.ts) accesses `.result` directly
     * and has null-checks for utility results (rawReturnValues ? decode : []).
     * We return type-appropriate empty results to stay compatible.
     */
    private async handleBatch(methods: Array<{ name: string; args: unknown[] }>, ctx: SessionContext): Promise<unknown> {
        const results: Array<{ name: string; result: unknown }> = [];
        for (const method of methods) {
            try {
                const result = await this.dispatch(method.name, method.args, ctx);
                results.push({ name: method.name, result });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.log("wallet-sdk", LogLevel.Error, `Batch method ${method.name} failed: ${message}`);
                results.push({ name: method.name, result: this.emptyBatchResult(method.name) });
            }
        }
        return results;
    }

    /**
     * Return a SDK-compatible empty result for a failed batch method.
     *
     * The aztec.js BatchCall.simulate() unpacks results by type:
     * - simulateUtility: `(result as UtilitySimulationResult).result` — has null-check
     * - simulateTx: `result as TxSimulationResult` — calls methods on it
     *
     * For simulateUtility, { result: null } triggers the existing null-check
     * which returns [] (empty decoded values). For other types we return null.
     */
    private emptyBatchResult(methodName: string): unknown {
        switch (methodName) {
            case "simulateUtility":
                // UtilitySimulationResult shape — the SDK does:
                //   rawReturnValues = (result as UtilitySimulationResult).result
                //   rawReturnValues ? decodeFromAbi(...) : []
                // So { result: null } safely falls through to []
                return { result: null };
            default:
                return null;
        }
    }

    /**
     * Handle sendTx by routing through DappInteractionService.
     *
     * Unlike other methods that go directly to ExecutionService, sendTx needs
     * the confirmation popup for fee selection. DappInteractionService.execute()
     * validates the session, checks if confirmation is needed, and opens the
     * popup for user approval + fee method selection.
     */
    private async handleSendTx(args: unknown[], ctx: SessionContext): Promise<unknown> {
        const [network, account] = await this.resolveNetworkAndAccount(ctx);
        const caipAccount = `aztec:${ctx.chainId}:${account.address}`;

        const dappSession = await this.dappSessionService.tryGetDappSessionByOrigin(ctx.origin);
        if (!dappSession) {
            throw new Error(`No dApp session found for origin ${ctx.origin}`);
        }

        const opts = { ...(args[1] as any ?? {}), from: account.address };

        const results: ExecutionResult = await this.dappInteractionService.execute({
            sessionId: dappSession.id,
            operations: [{
                kind: "aztec_sendTx" as const,
                account: caipAccount as `aztec:${number}:${string}`,
                exec: args[0] as any,
                opts,
            }],
        });

        return this.unwrapResult(results[0]);
    }

    /**
     * Handle requestCapabilities with 3-phase approach:
     * 1. Check stored grants → compute delta (new/changed types)
     *    - Previously rejected types are included in delta (re-request)
     * 2. Early return if delta is empty (all already granted)
     * 3. Show popup for delta → user approves → merge and store
     *    - Track rejected types for future re-request detection
     */
    private async handleRequestCapabilities(manifest: any, ctx: SessionContext): Promise<unknown> {
        const dappSession = await this.dappSessionService.tryGetDappSessionByOrigin(ctx.origin);
        if (!dappSession) {
            throw new Error(`No dApp session found for origin ${ctx.origin}`);
        }

        const requestedCapabilities: any[] = manifest?.capabilities ?? [];
        if (requestedCapabilities.length === 0) {
            return {
                version: "1.0" as const,
                granted: [],
                wallet: { name: "Azguard Wallet", version: packageJson.version },
            };
        }

        // Phase 1: Check existing grants and rejections
        const existingGrants = dappSession.capabilityGrants ?? [];
        const existingRejections = dappSession.capabilityRejections ?? [];
        const grantedTypes = new Set(existingGrants.map(g => g.capability.type));
        const rejectedTypes = new Set(existingRejections.map(r => r.capabilityType));

        // Delta: capabilities not yet granted OR previously rejected (re-request)
        const delta = requestedCapabilities.filter(
            cap => !grantedTypes.has(cap.type) || rejectedTypes.has(cap.type),
        );
        // Track which delta items are re-requests (previously rejected)
        const reRequested = requestedCapabilities
            .filter(cap => rejectedTypes.has(cap.type))
            .map(cap => cap.type as string);

        // Phase 2: Early return if all types already granted and none re-requested
        if (delta.length === 0) {
            const granted = await this.enrichGrantedCapabilities(
                existingGrants.map(g => g.capability),
                requestedCapabilities,
                ctx,
                dappSession,
            );
            return {
                version: "1.0" as const,
                granted,
                wallet: { name: "Azguard Wallet", version: packageJson.version },
            };
        }

        // Phase 3: Show capability popup for delta
        const existingCaps = existingGrants
            .filter(g => !rejectedTypes.has(g.capability.type)) // Don't show re-requested as "existing"
            .map(g => g.capability);

        // If `accounts` type is in the delta, load available accounts for the popup
        const hasAccountsInDelta = delta.some(cap => cap.type === "accounts");
        let availableAccounts: Array<{ address: string; name: string; chainId: number }> | undefined;
        if (hasAccountsInDelta) {
            const network = await this.resolveNetwork(ctx);
            const accounts = await this.accountService.getAccounts(ctx.profileId, network.chainId);
            availableAccounts = accounts.map(acc => ({
                address: acc.address,
                name: acc.name,
                chainId: acc.chainId,
            }));
        }

        const result = await this.dappInteractionService.requestCapabilities({
            sessionId: dappSession.id,
            manifest,
            delta,
            existingGrants: existingCaps,
            reRequested,
            availableAccounts,
        });

        // Safety net: ensure accounts capability is in granted when accounts were selected
        if (result.selectedAccounts && result.selectedAccounts.length > 0) {
            const hasAccountsInGranted = result.granted.some((cap: any) => cap.type === "accounts");
            if (!hasAccountsInGranted) {
                const accountsCap = delta.find(cap => cap.type === "accounts");
                if (accountsCap) {
                    result.granted.push(accountsCap);
                }
            }
        }

        // If accounts were selected in the popup, merge with existing (don't replace)
        if (result.selectedAccounts && result.selectedAccounts.length > 0) {
            const existingAccounts = new Set(dappSession.accounts ?? []);
            for (const acc of result.selectedAccounts) {
                existingAccounts.add(acc);
            }
            const mergedAccounts = [...existingAccounts];

            await this.dappSessionService.updateDappSession(
                dappSession.id,
                dappSession.permissions,
                mergedAccounts,
                dappSession.confirmationLevel,
            );
            if (result.accountAliases) {
                await this.dappSessionService.setAccountAliases(dappSession.id, result.accountAliases);
            }
        }

        // Compute which delta types were approved vs rejected
        const approvedTypes = new Set(result.granted.map((cap: any) => cap.type));
        const now = Date.now();

        // New grants: approved delta items that weren't already granted
        const newGrants = result.granted
            .filter((cap: any) => !grantedTypes.has(cap.type) || rejectedTypes.has(cap.type))
            .map((cap: any) => ({ capability: cap, grantedAt: now }));
        // Merge: keep existing grants (excluding re-approved types) + new grants
        const mergedGrants = [
            ...existingGrants.filter(g => !rejectedTypes.has(g.capability.type)),
            ...newGrants,
        ];

        await this.dappSessionService.setCapabilityGrants(dappSession.id, mergedGrants);

        // Track rejections: delta items that were NOT approved
        const newRejections: RejectedCapabilityRecord[] = delta
            .filter(cap => !approvedTypes.has(cap.type))
            .map(cap => ({ capabilityType: cap.type, rejectedAt: now }));
        // Merge: keep old rejections for types not in this delta + new rejections
        const deltaTypes = new Set(delta.map((cap: any) => cap.type));
        const mergedRejections = [
            ...existingRejections.filter(r => !deltaTypes.has(r.capabilityType)),
            ...newRejections,
        ];
        await this.dappSessionService.setCapabilityRejections(dappSession.id, mergedRejections);

        // Reload session to pick up updated accounts/aliases
        const updatedSession = await this.dappSessionService.getDappSession(dappSession.id);

        const granted = await this.enrichGrantedCapabilities(
            mergedGrants.map(g => g.capability),
            requestedCapabilities,
            ctx,
            updatedSession,
        );

        return {
            version: "1.0" as const,
            granted,
            wallet: { name: "Azguard Wallet", version: packageJson.version },
        };
    }

    /**
     * Enrich granted capabilities with runtime data.
     * For "accounts" type: inject the actual account list with per-app aliases.
     */
    private async enrichGrantedCapabilities(
        grantedCaps: any[],
        requestedCaps: any[],
        ctx: SessionContext,
        dappSession: any,
    ): Promise<any[]> {
        const result: any[] = [];
        // Use requested caps as the template to preserve the dApp's original fields
        const grantedTypes = new Set(grantedCaps.map((c: any) => c.type));

        for (const cap of requestedCaps) {
            if (!grantedTypes.has(cap.type)) continue;

            if (cap.type === "accounts") {
                const network = await this.resolveNetwork(ctx);
                const allAccounts = await this.accountService.getAccounts(ctx.profileId, network.chainId);
                const sessionAddresses = this.getSessionAccountAddresses(dappSession, ctx.chainId);
                const sessionAccounts = allAccounts.filter(acc => sessionAddresses.has(acc.address));

                result.push({
                    ...cap,
                    accounts: sessionAccounts.map(acc => {
                        const caip = `aztec:${ctx.chainId}:${acc.address}`;
                        const alias = dappSession.accountAliases?.[caip] ?? acc.name ?? "";
                        return { alias, item: acc.address };
                    }),
                });
            } else {
                result.push(cap);
            }
        }
        return result;
    }

    /**
     * Enforce capability grants before dispatching a method call.
     *
     * - Exempt methods (getChainInfo, requestCapabilities, batch, getAccounts) skip enforcement.
     * - The method's required capability type must be in the session's grants.
     * - Sessions without grants (new or pre-migration) are treated as having no grants,
     *   so non-exempt methods are blocked until requestCapabilities() is called.
     */
    private async enforceCapability(methodName: string, ctx: SessionContext): Promise<void> {
        if (isCapabilityExempt(methodName)) return;

        const requiredType = getRequiredCapability(methodName);
        if (!requiredType) return; // Unknown method — let dispatch() handle it

        const dappSession = await this.dappSessionService.tryGetDappSessionByOrigin(ctx.origin);
        if (!dappSession) return; // No session yet — let the method handler deal with it

        const grantedTypes = new Set((dappSession.capabilityGrants ?? []).map(g => g.capability.type));
        if (!grantedTypes.has(requiredType)) {
            throw new Error(`Capability "${requiredType}" not granted. The dApp must call requestCapabilities() first.`);
        }
    }

    /**
     * Build an Operation from wallet-sdk method args and session context.
     *
     * The wallet-sdk sends args as positional arrays matching the WalletSchema
     * function signatures. For Aztec.js Wallet methods, the args map directly
     * to the operation fields. For Azguard custom methods, we unpack them
     * according to the schema_patch.ts definitions.
     */
    private async buildOperation(kind: Operation["kind"], args: unknown[], ctx: SessionContext): Promise<Operation> {
        if (NETWORK_ONLY_KINDS.has(kind)) {
            const network = await this.resolveNetwork(ctx);
            return this.buildNetworkOperation(kind, args, network.id);
        }

        if (ACCOUNT_KINDS.has(kind)) {
            const [network, account] = await this.resolveNetworkAndAccount(ctx);
            return this.buildAccountOperation(kind, args, network.id, account.address);
        }

        throw new Error(`Unhandled operation kind: ${kind}`);
    }

    /**
     * Build operations that only need network context.
     *
     * Wallet-sdk args for these methods:
     *   - getChainInfo(): []
     *   - getContractClassMetadata(id): [Fr]
     *   - getContractMetadata(address): [AztecAddress]
     *   - getPrivateEvents(eventMetadata, eventFilter): [EventMetadataDefinition, PrivateEventFilter]
     *   - registerSender(address, alias?): [AztecAddress, string?]
     *   - getAddressBook(): []
     *   - registerContract(instance, artifact?, secretKey?): [ContractInstanceWithAddress, ContractArtifact?, Fr?]
     */
    private buildNetworkOperation(kind: Operation["kind"], args: unknown[], networkId: string): Operation {
        switch (kind) {
            case "aztec_getChainInfo":
                return { kind, networkId };
            case "aztec_getContractClassMetadata":
                return { kind, networkId, id: args[0] as any };
            case "aztec_getContractMetadata":
                return { kind, networkId, address: args[0] as any };
            case "aztec_getPrivateEvents":
                return { kind, networkId, eventMetadata: args[0] as any, eventFilter: args[1] as any };
            case "aztec_registerSender":
                return { kind, networkId, address: args[0] as any, alias: args[1] as string | undefined };
            case "aztec_getAddressBook":
                return { kind, networkId };
            case "aztec_registerContract":
                return { kind, networkId, instance: args[0] as any, artifact: args[1] as any, secretKey: args[2] as any };
            default:
                throw new Error(`Unknown network operation: ${kind}`);
        }
    }

    /**
     * Build operations that need account context.
     *
     * Wallet-sdk args for these methods:
     *   - simulateTx(exec, opts): [ExecutionPayload, SimulateOptions]
     *   - simulateUtility(call, opts): [FunctionCall, SimulateUtilityOptions]
     *   - profileTx(exec, opts): [ExecutionPayload, ProfileOptions]
     *   - createAuthWit(messageHashOrIntent): [IntentInnerHash | CallIntent]
     *   - registerToken(account, token): [AztecAddress, AztecAddress]
     *   - getCompleteAddress(account): [AztecAddress]
     *   - simulateViews(calls): [FunctionCall[]]
     */
    private buildAccountOperation(
        kind: Operation["kind"],
        args: unknown[],
        networkId: string,
        accountAddress: string,
    ): Operation {
        switch (kind) {
            case "aztec_simulateTx":
                return { kind, networkId, accountAddress, exec: args[0] as any, opts: { ...(args[1] as any ?? {}), from: accountAddress } };
            case "aztec_simulateUtility":
                return { kind, networkId, accountAddress, call: args[0] as any, opts: { ...(args[1] as any ?? {}), from: accountAddress } };
            case "aztec_profileTx":
                return { kind, networkId, accountAddress, exec: args[0] as any, opts: { ...(args[1] as any ?? {}), from: accountAddress } };
            case "aztec_createAuthWit":
                return { kind, networkId, accountAddress, messageHashOrIntent: args[0] as any };
            case "register_token":
                // schema_patch: registerToken(account: AztecAddress, token: AztecAddress)
                // The first arg is the account (already resolved), second is the token address
                return { kind, networkId, accountAddress, address: (args[1] as any).toString() };
            case "get_complete_address":
                // schema_patch: getCompleteAddress(account: AztecAddress)
                return { kind, networkId, accountAddress };
            case "simulate_views":
                // schema_patch: simulateViews(calls: FunctionCall[])
                // The calls come as FunctionCall[] from the schema. ExecutionService expects
                // (CallAction | EncodedCallAction)[]. We convert FunctionCall → EncodedCallAction.
                return {
                    kind,
                    networkId,
                    accountAddress,
                    calls: this.functionCallsToEncodedActions(args[0] as any[]),
                };
            default:
                throw new Error(`Unknown account operation: ${kind}`);
        }
    }

    /**
     * Convert FunctionCall[] (from wallet-sdk) to EncodedCallAction[] (for ExecutionService).
     *
     * The wallet-sdk sends FunctionCall objects (with `to`, `selector`, `args` as Fr[], etc).
     * The ExecutionService's SimulateViewsOperation expects `(CallAction | EncodedCallAction)[]`.
     * We convert to EncodedCallAction format which uses string representations.
     */
    private functionCallsToEncodedActions(calls: any[]): any[] {
        return calls.map((call: any) => ({
            kind: "encoded_call" as const,
            to: call.to?.toString(),
            selector: call.selector?.toString(),
            args: (call.args ?? []).map((a: any) => a.toString()),
            name: call.name,
            type: call.type,
            isStatic: call.isStatic,
            hideMsgSender: call.hideMsgSender,
            returnTypes: call.returnTypes ?? [],
        }));
    }

    /**
     * Extract account addresses from a dApp session's CAIP accounts for the given chain.
     */
    private getSessionAccountAddresses(dappSession: any, chainId: number): Set<string> {
        return new Set(
            dappSession.accounts
                ?.filter((caip: string) => caip.startsWith(`aztec:${chainId}:`))
                .map((caip: string) => caip.split(":")[2]) ?? [],
        );
    }

    /**
     * Resolve a session's chainId to a Network.
     */
    private async resolveNetwork(ctx: SessionContext): Promise<Network> {
        const networks = await this.networkService.getNetworks(ctx.chainId);
        if (networks.length === 0) {
            throw new Error(`No network configured for chainId ${ctx.chainId}`);
        }
        return networks.find(n => n.isDefault) ?? networks[0];
    }

    /**
     * Resolve a session's chainId to a Network + an authorized Account.
     *
     * Filters accounts to those authorized in the dApp session. If the session
     * has explicit accounts, only those are eligible. This ensures account-scoped
     * operations (simulateTx, sendTx, etc.) use session-authorized accounts,
     * not just the first global account.
     */
    private async resolveNetworkAndAccount(ctx: SessionContext): Promise<[Network, Account]> {
        const network = await this.resolveNetwork(ctx);
        const allAccounts = await this.accountService.getAccounts(ctx.profileId, network.chainId);
        if (allAccounts.length === 0) {
            throw new Error(`No accounts found for profile ${ctx.profileId} on chainId ${ctx.chainId}`);
        }

        const dappSession = await this.dappSessionService.tryGetDappSessionByOrigin(ctx.origin);
        if (dappSession?.accounts && dappSession.accounts.length > 0) {
            const sessionAddresses = this.getSessionAccountAddresses(dappSession, ctx.chainId);
            const sessionAccount = allAccounts.find(acc => sessionAddresses.has(acc.address));
            if (sessionAccount) {
                return [network, sessionAccount];
            }
            throw new Error("No authorized accounts found for this dApp session");
        }

        // No session or no accounts on session — require account authorization
        throw new Error("No accounts authorized. The dApp must call requestCapabilities() with accounts type first.");
    }

    /**
     * Unwrap an OperationResult, returning the value or throwing on failure.
     */
    private unwrapResult(result: OperationResult): unknown {
        switch (result.status) {
            case "ok":
                return result.result;
            case "failed":
                throw new Error(result.error);
            case "skipped":
                throw new Error("Operation was skipped");
        }
    }
}
