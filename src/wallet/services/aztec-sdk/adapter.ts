import type { ChainInfo } from "@aztec/aztec.js/account";
import type { AppCapabilities, GrantedCapability } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { WalletMessage } from "@aztec/wallet-sdk/types";
import type { DappPermissions } from "@/wallet/services/dapp-session/spec";
import type { CaipChain, CaipAccount, OperationRequest, CapabilitiesResult } from "@/wallet/services/dapp-interaction/spec";
import type {
    AztecGetContractMetadataOperation,
    AztecGetContractClassMetadataOperation,
    AztecGetPrivateEventsOperation,
    AztecRegisterSenderOperation,
    AztecRegisterContractOperation,
    AztecSimulateTxOperation,
    AztecSimulateUtilityOperation,
    AztecProfileTxOperation,
    AztecSendTxOperation,
    AztecCreateAuthWitOperation,
} from "@/wallet/services/execution/models/operation";
import { trimAddress } from "@/utils/string";

/** Validates that an account address is present and non-empty. */
function requireAccountAddress(value: unknown, errorMessage: string): string {
    const address = value != null ? String(value) : "";
    if (!address) {
        throw new Error(`Missing account parameter: ${errorMessage}`);
    }
    return address;
}

/**
 * Computes Azguard's internal chainId from SDK's ChainInfo.
 *
 * ChainInfo has { chainId: Fr (L1), version: Fr (rollup) }.
 * Both arrive as hex strings after jsonStringify → JSON.parse serialization.
 * Azguard stores chainId as `l1ChainId ^ rollupVersion` (see NetworkService.getChainId).
 *
 * Sandbox (l1ChainId 31337) is stored with chainId=0 to match NetworkService.getChainId.
 */
export function resolveChainId(chainInfo: ChainInfo): number {
    const l1ChainId = Number(BigInt(String(chainInfo.chainId)));
    const rollupVersion = Number(BigInt(String(chainInfo.version)));
    // Sandbox uses l1ChainId 31337 (Anvil default).
    // NOTE: NetworkService.getChainId detects sandbox by URL instead (localhost:8080).
    if (l1ChainId === 31337) {
        return 0;
    }
    // Use BigInt XOR to avoid JS signed 32-bit int semantics that produce
    // negative results when rollupVersion > 2^31-1, crashing Fr field
    // constructors downstream.
    return Number(BigInt(l1ChainId) ^ BigInt(rollupVersion));
}

/**
 * Maps a WalletMessage to an OperationRequest (CAIP format) for DappInteractionService.
 *
 * Produces OperationRequest types (CAIP format) for DappInteractionService:
 * - Network-scoped ops use `chain: CaipChain` instead of `networkId`
 * - Account-scoped ops use `account: CaipAccount` instead of `networkId + accountAddress`
 * - `aztec_sendTx` omits `feeSettings` (DappInteractionService sets "embedded" based on exec.feePayer)
 * - `aztec_getAccounts` omits `accounts` (DappInteractionService fills from session.accounts)
 */
export function walletMessageToOperationRequest(
    message: WalletMessage,
    chainId: number,
): OperationRequest {
    const { type, args } = message;
    const chain: CaipChain = `aztec:${chainId}`;

    switch (type) {
        case "getChainInfo":
            return { kind: "aztec_getChainInfo", chain };

        case "getAccounts":
            return { kind: "aztec_getAccounts", chain };

        case "getAddressBook":
            return { kind: "aztec_getAddressBook", chain };

        case "getContractMetadata":
            return {
                kind: "aztec_getContractMetadata",
                chain,
                address: args[0] as AztecGetContractMetadataOperation["address"],
            };

        case "getContractClassMetadata":
            return {
                kind: "aztec_getContractClassMetadata",
                chain,
                id: args[0] as AztecGetContractClassMetadataOperation["id"],
            };

        case "getPrivateEvents":
            return {
                kind: "aztec_getPrivateEvents",
                chain,
                eventMetadata: args[0] as AztecGetPrivateEventsOperation["eventMetadata"],
                eventFilter: args[1] as AztecGetPrivateEventsOperation["eventFilter"],
            };

        case "registerSender":
            return {
                kind: "aztec_registerSender",
                chain,
                address: args[0] as AztecRegisterSenderOperation["address"],
                alias: args[1] as AztecRegisterSenderOperation["alias"],
            };

        case "registerContract":
            return {
                kind: "aztec_registerContract",
                chain,
                instance: args[0] as AztecRegisterContractOperation["instance"],
                artifact: args[1] as AztecRegisterContractOperation["artifact"],
                secretKey: args[2] as AztecRegisterContractOperation["secretKey"],
            };

        case "simulateTx": {
            const exec = args[0] as AztecSimulateTxOperation["exec"];
            const opts = args[1] as AztecSimulateTxOperation["opts"] | undefined;
            const accountAddress = requireAccountAddress(opts?.from, "simulateTx requires opts.from");
            return {
                kind: "aztec_simulateTx",
                account: `${chain}:${accountAddress}` as CaipAccount,
                exec,
                opts: opts!,
            };
        }

        case "simulateUtility": {
            const call = args[0] as AztecSimulateUtilityOperation["call"];
            const opts = args[1] as AztecSimulateUtilityOperation["opts"] | undefined;
            const accountAddress = requireAccountAddress(opts?.scope, "simulateUtility requires opts.scope");
            return {
                kind: "aztec_simulateUtility",
                account: `${chain}:${accountAddress}` as CaipAccount,
                call,
                opts: opts!,
            };
        }

        case "profileTx": {
            const exec = args[0] as AztecProfileTxOperation["exec"];
            const opts = args[1] as AztecProfileTxOperation["opts"] | undefined;
            const accountAddress = requireAccountAddress(opts?.from, "profileTx requires opts.from");
            return {
                kind: "aztec_profileTx",
                account: `${chain}:${accountAddress}` as CaipAccount,
                exec,
                opts: opts!,
            };
        }

        case "sendTx": {
            const exec = args[0] as AztecSendTxOperation["exec"];
            const opts = args[1] as AztecSendTxOperation["opts"] | undefined;
            const accountAddress = requireAccountAddress(opts?.from, "sendTx requires opts.from");
            return {
                kind: "aztec_sendTx",
                account: `${chain}:${accountAddress}` as CaipAccount,
                exec,
                opts: opts!,
            };
        }

        case "createAuthWit": {
            const accountAddress = requireAccountAddress(args[0], "createAuthWit requires account address");
            return {
                kind: "aztec_createAuthWit",
                account: `${chain}:${accountAddress}` as CaipAccount,
                messageHashOrIntent: args[1] as AztecCreateAuthWitOperation["messageHashOrIntent"],
            };
        }

        default:
            throw new Error(`Unsupported SDK method: ${type}`);
    }
}

/**
 * Base methods always granted on SDK discovery approval (not capability-gated).
 *
 * These are auto-granted because the SDK protocol has no mechanism for dApps to
 * request them via `requestCapabilities` — they are assumed available after discovery.
 *
 * TODO: Consider letting the user toggle these during discovery approval.
 * Challenges:
 * - `getChainInfo` is harmless (public network info), safe to always grant.
 * - `registerSender` could be used to spam the wallet's address book with entries.
 *   However, if the user denies it at discovery, the dApp cannot re-request it
 *   (no SDK mechanism for that), so the user would have to delete the session and
 *   reconnect to change their mind. For now, auto-granting is the pragmatic choice.
 */
export const BASE_METHODS = ["aztec_getChainInfo", "aztec_registerSender"];

/**
 * Maps an AppCapabilities manifest to DappPermissions + GrantedCapability[].
 *
 * For each capability in the manifest, maps to Aztec SDK method names
 * and builds the corresponding GrantedCapability with accounts/scope filled in.
 */
export function capabilitiesToPermissions(
    manifest: AppCapabilities,
    chainId: number,
    accountsMap: Map<number, string[]>,
): CapabilitiesResult {
    const chain: CaipChain = `aztec:${chainId}`;
    const methods = new Set<string>(BASE_METHODS);
    const granted: GrantedCapability[] = [];

    for (let i = 0; i < manifest.capabilities.length; i++) {
        const cap = manifest.capabilities[i];
        switch (cap.type) {
            case "accounts": {
                if (cap.canGet) methods.add("aztec_getAccounts");
                if (cap.canCreateAuthWit) methods.add("aztec_createAuthWit");
                const capAccounts = accountsMap.get(i) ?? [];
                granted.push({
                    ...cap,
                    accounts: capAccounts.map(addr => ({
                        alias: trimAddress(addr),
                        item: AztecAddress.fromString(addr),
                    })),
                });
                break;
            }
            case "contracts": {
                if (cap.canRegister) methods.add("aztec_registerContract");
                if (cap.canGetMetadata) methods.add("aztec_getContractMetadata");
                granted.push({ ...cap });
                break;
            }
            case "contractClasses": {
                if (cap.canGetMetadata) methods.add("aztec_getContractClassMetadata");
                granted.push({ ...cap });
                break;
            }
            case "simulation": {
                if (cap.transactions) {
                    methods.add("aztec_simulateTx");
                    methods.add("aztec_profileTx");
                }
                if (cap.utilities) methods.add("aztec_simulateUtility");
                granted.push({ ...cap });
                break;
            }
            case "transaction": {
                methods.add("aztec_sendTx");
                granted.push({ ...cap });
                break;
            }
            case "data": {
                if (cap.addressBook) methods.add("aztec_getAddressBook");
                if (cap.privateEvents) methods.add("aztec_getPrivateEvents");
                granted.push({ ...cap });
                break;
            }
        }
    }

    const permissions: DappPermissions[] = [
        {
            chains: [chain],
            methods: [...methods],
        },
    ];

    const allAddresses = new Set<string>();
    for (const addrs of accountsMap.values()) {
        for (const addr of addrs) {
            allAddresses.add(addr);
        }
    }
    const accounts = [...allAddresses].map(addr => `${chain}:${addr}` as CaipAccount);

    return { granted, permissions, accounts };
}
