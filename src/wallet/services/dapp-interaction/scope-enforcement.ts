import type { OperationRequest } from "./spec";

// Serialized capability types — shapes after jsonSanitize() on GrantedCapability instances.
// AztecAddress/Fr become strings, everything else passes through.

export type SerializedPattern = { contract: "*" | string; function: string };
export type SerializedScope = "*" | SerializedPattern[];

export type SerializedAccountsCapability = {
    type: "accounts";
    canGet?: boolean;
    canCreateAuthWit?: boolean;
    accounts: { alias: string; item: string }[];
};

export type SerializedContractsCapability = {
    type: "contracts";
    contracts: "*" | string[];
    canRegister?: boolean;
    canGetMetadata?: boolean;
};

export type SerializedContractClassesCapability = {
    type: "contractClasses";
    classes: "*" | string[];
    canGetMetadata: boolean;
};

export type SerializedSimulationCapability = {
    type: "simulation";
    transactions?: { scope: SerializedScope };
    utilities?: { scope: SerializedScope };
};

export type SerializedTransactionCapability = {
    type: "transaction";
    scope: SerializedScope;
};

export type SerializedDataCapability = {
    type: "data";
    addressBook?: boolean;
    privateEvents?: { contracts: "*" | string[] };
};

export type SerializedCapability =
    | SerializedAccountsCapability
    | SerializedContractsCapability
    | SerializedContractClassesCapability
    | SerializedSimulationCapability
    | SerializedTransactionCapability
    | SerializedDataCapability;

// Narrowed types for type-safe filtering of optional sub-capabilities.

type SimulationWithTransactions = SerializedSimulationCapability & {
    transactions: { scope: SerializedScope };
};

type SimulationWithUtilities = SerializedSimulationCapability & {
    utilities: { scope: SerializedScope };
};

type DataWithPrivateEvents = SerializedDataCapability & {
    privateEvents: { contracts: "*" | string[] };
};

// --- Helpers ---

/** Checks if an address/id is in a wildcard-or-list. */
function addressInList(list: "*" | string[], address: string): boolean {
    return list === "*" || list.includes(address);
}

/** Matches a single contract+function against a ContractFunctionPattern. */
function matchesPattern(pattern: SerializedPattern, contractAddr: string, fnName: string): boolean {
    return (pattern.contract === "*" || pattern.contract === contractAddr)
        && (pattern.function === "*" || pattern.function === fnName);
}

/** Checks if a single call is within a scope (wildcard or pattern array). */
function callMatchesScope(scope: SerializedScope, contractAddr: string, fnName: string): boolean {
    if (scope === "*") return true;
    return scope.some(p => matchesPattern(p, contractAddr, fnName));
}

/** Checks that every call is authorized by at least one of the given scopes. */
function allCallsInScope(scopes: SerializedScope[], calls: any[]): boolean {
    return calls.every(call => {
        const contractAddr = call.to?.toString() ?? "";
        const fnName = call.name ?? "";
        return scopes.some(scope => callMatchesScope(scope, contractAddr, fnName));
    });
}

// --- Main ---

/**
 * Enforces that an operation is within the granted capability scope.
 * Throws if no matching capability authorizes the operation.
 *
 * Operations not subject to scope enforcement (getChainInfo, registerSender,
 * getAccounts, getAddressBook, createAuthWit) pass through without checks.
 */
export function enforceCapabilityScope(capabilities: unknown[], operation: OperationRequest): void {
    const caps = capabilities as SerializedCapability[];

    switch (operation.kind) {
        case "aztec_registerContract": {
            const address = operation.instance.address?.toString() ?? "";
            const matching = caps.filter(
                (c): c is SerializedContractsCapability => c.type === "contracts" && !!c.canRegister,
            );
            if (!matching.some(c => addressInList(c.contracts, address))) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_getContractMetadata": {
            const address = operation.address?.toString() ?? "";
            const matching = caps.filter(
                (c): c is SerializedContractsCapability => c.type === "contracts" && !!c.canGetMetadata,
            );
            if (!matching.some(c => addressInList(c.contracts, address))) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_getContractClassMetadata": {
            const id = operation.id?.toString() ?? "";
            const matching = caps.filter(
                (c): c is SerializedContractClassesCapability => c.type === "contractClasses" && !!c.canGetMetadata,
            );
            if (!matching.some(c => addressInList(c.classes, id))) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_sendTx": {
            const calls: any[] = operation.exec.calls ?? [];
            const scopes = caps
                .filter((c): c is SerializedTransactionCapability => c.type === "transaction")
                .map(c => c.scope);
            if (!allCallsInScope(scopes, calls)) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_simulateTx":
        case "aztec_profileTx": {
            const calls: any[] = operation.exec.calls ?? [];
            const scopes = caps
                .filter((c): c is SimulationWithTransactions => c.type === "simulation" && !!c.transactions)
                .map(c => c.transactions.scope);
            if (!allCallsInScope(scopes, calls)) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_simulateUtility": {
            const call = operation.call as any;
            const contractAddr = call?.to?.toString() ?? "";
            const fnName = call?.name ?? "";
            const scopes = caps
                .filter((c): c is SimulationWithUtilities => c.type === "simulation" && !!c.utilities)
                .map(c => c.utilities.scope);
            if (!scopes.some(scope => callMatchesScope(scope, contractAddr, fnName))) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_getPrivateEvents": {
            const contractAddress = operation.eventFilter.contractAddress?.toString() ?? "";
            const matching = caps.filter(
                (c): c is DataWithPrivateEvents => c.type === "data" && !!c.privateEvents,
            );
            if (!matching.some(c => addressInList(c.privateEvents.contracts, contractAddress))) {
                throw new Error("Operation not in capability scope");
            }
            break;
        }
        case "aztec_createAuthWit": {
            const accountAddress = operation.account.split(":").at(-1) ?? "";
            const matching = caps.filter(
                (c): c is SerializedAccountsCapability => c.type === "accounts" && !!c.canCreateAuthWit,
            );
            if (!matching.some(c => c.accounts.some(a => a.item === accountAddress))) {
                throw new Error("Operation not in capability scope");
            }
            // TODO: Consider also validating that CallIntent-based auth witnesses fall within
            // the granted transaction/simulation scopes, or prompting the user for explicit
            // approval of each auth witness.
            break;
        }
        // Operations not subject to scope enforcement: getChainInfo, registerSender,
        // getAccounts, getAddressBook pass through without checks.
    }
}
