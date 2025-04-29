import { DappMetadata, DappPermissions } from "@/wallet/services/dapp-session/client";
import {
    OperationKind,
    ActionKind,
    AuthwitContentKind,
    CaipChain,
    CaipAccount,
    ConnectionParams,
    ExecutionParams,
    Operation,
    GetCompleteAddressOperation,
    RegisterContractOperation,
    RegisterSenderOperation,
    SendTransactionOperation,
    SimulateTransactionOperation,
    SimulateUtilityOperation,
    SimulateViewsOperation,
    Action,
    AddCapsuleAction,
    AddPrivateAuthwitAction,
    AddPublicAuthwitAction,
    CallAction,
    EncodedCallAction,
    AuthwitContent,
    CallAuthwitContent,
    EncodedCallAuthwitContent,
    IntentAuthwitContent,
    MessageHashAuthwitContent,
} from "@/wallet/services/dapp-interaction/types";
import { RpcEvent /*, RpcMethod*/ } from "./types";

export function parseConnectionParams(data: any): ConnectionParams {
    if (!data) {
        throw new Error("Invalid connection params");
    }
    if (!data.dappMetadata) {
        throw new Error("Invalid dapp metadata");
    }
    return {
        dappMetadata: parseDappMetadata(data.dappMetadata),
        requiredPermissions: parseArrayProp(data, "requiredPermissions", parseDappPermissions),
        optionalPermissions: parseOptionalArrayProp(data, "optionalPermissions", parseDappPermissions),
    };
}

export function parseDappMetadata(data: any): DappMetadata {
    if (data.name !== undefined && typeof data.name !== "string") {
        throw new Error("Dapp name must be a string");
    }
    if (data.description !== undefined && typeof data.description !== "string") {
        throw new Error("Dapp description must be a string");
    }
    if (data.logo !== undefined && typeof data.logo !== "string") {
        throw new Error("Dapp logo must be a string");
    }
    if (data.url !== undefined && typeof data.url !== "string") {
        throw new Error("Dapp url must be a string");
    }
    return {
        name: parseOptionalStringProp(data, "name"),
        description: parseOptionalStringProp(data, "description"),
        logo: parseOptionalStringProp(data, "logo"),
        url: parseOptionalStringProp(data, "url"),
    };
}

export function parseDappPermissions(data: any): DappPermissions {
    return {
        chains: parseOptionalArrayProp(data, "chains", parseChain),
        methods: parseOptionalArrayProp(data, "methods", parseMethod),
        events: parseOptionalArrayProp(data, "events", parseEvent),
    };
}

export function parseMethod(data: any): string {
    switch (data) {
        // case RpcMethod.get_wallet_info:
        // case RpcMethod.get_session:
        // case RpcMethod.close_session:
        // case RpcMethod.connect:
        // case RpcMethod.execute:
        case OperationKind.GetCompleteAddress:
        case OperationKind.RegisterSender:
        case OperationKind.RegisterContract:
        case OperationKind.SendTransaction:
        case OperationKind.SimulateTransaction:
        case OperationKind.SimulateUtility:
        case OperationKind.SimulateViews:
        case ActionKind.AddCapsule:
        case ActionKind.AddPrivateAuthwit:
        case ActionKind.AddPublicAuthwit:
        case ActionKind.Call:
        case ActionKind.EncodedCall:
            return data;
        default:
            throw new Error("Invalid method");
    }
}

export function parseEvent(data: any): string {
    switch (data) {
        case RpcEvent.session_updated:
        case RpcEvent.session_closed:
            return data;
        default:
            throw new Error("Invalid event");
    }
}

export function parseExecutionParams(data: any): ExecutionParams {
    if (!data) {
        throw new Error("Invalid execution params");
    }
    return {
        sessionId: parseStringProp(data, "sessionId"),
        operations: parseArrayProp(data, "operations", parseOperation),
    };
}

function parseOperation(data: any): Operation {
    switch (data?.kind) {
        case OperationKind.GetCompleteAddress: {
            return parseGetCompleteAddressOperation(data);
        }
        case OperationKind.RegisterContract: {
            return parseRegisterContractOperation(data);
        }
        case OperationKind.RegisterSender: {
            return parseRegisterSenderOperation(data);
        }
        case OperationKind.SendTransaction: {
            return parseSendTransactionOperation(data);
        }
        case OperationKind.SimulateTransaction: {
            return parseSimulateTransactionOperation(data);
        }
        case OperationKind.SimulateUtility: {
            return parseSimulateUtilityOperation(data);
        }
        case OperationKind.SimulateViews: {
            return parseSimulateViewsOperation(data);
        }
        default: {
            throw new Error("Invalid operation");
        }
    }
}

function parseGetCompleteAddressOperation(data: any): GetCompleteAddressOperation {
    return {
        kind: OperationKind.GetCompleteAddress,
        account: parseAccountProp(data, "account"),
    };
}

function parseRegisterContractOperation(data: any): RegisterContractOperation {
    return {
        kind: OperationKind.RegisterContract,
        chain: parseChainProp(data, "chain"),
        address: parseStringProp(data, "address"),
        instance: data.instance, // TODO: implement validation
        artifact: data.artifact, // TODO: implement validation
    };
}

function parseRegisterSenderOperation(data: any): RegisterSenderOperation {
    return {
        kind: OperationKind.RegisterSender,
        chain: parseChainProp(data, "chain"),
        address: parseStringProp(data, "address"),
    };
}

function parseSendTransactionOperation(data: any): SendTransactionOperation {
    return {
        kind: OperationKind.SendTransaction,
        account: parseAccountProp(data, "account"),
        actions: parseArrayProp(data, "actions", parseAction),
        setup: parseOptionalArrayProp(data, "setup", parseAction),
    };
}

function parseSimulateTransactionOperation(data: any): SimulateTransactionOperation {
    return {
        kind: OperationKind.SimulateTransaction,
        account: parseAccountProp(data, "account"),
        actions: parseArrayProp(data, "actions", parseAction),
        setup: parseOptionalArrayProp(data, "setup", parseAction),
        simulatePublic: parseOptionalBooleanProp(data, "simulatePublic"),
    };
}

function parseSimulateUtilityOperation(data: any): SimulateUtilityOperation {
    return {
        kind: OperationKind.SimulateUtility,
        account: parseAccountProp(data, "account"),
        contract: parseStringProp(data, "contract"),
        method: parseStringProp(data, "method"),
        args: parseArrayProp(data, "args"),
    };
}

function parseSimulateViewsOperation(data: any): SimulateViewsOperation {
    return {
        kind: OperationKind.SimulateViews,
        account: parseAccountProp(data, "account"),
        calls: parseArrayProp(data, "calls", parseAction)
            .filter(x => x.kind === "call" || x.kind === "encoded_call"),
    };
}

function parseAction(data: any): Action {
    switch (data?.kind) {
        case ActionKind.AddCapsule: {
            return parseAddCapsuleAction(data);
        }
        case ActionKind.AddPrivateAuthwit: {
            return parseAddPrivateAuthwitAction(data);
        }
        case ActionKind.AddPublicAuthwit: {
            return parseAddPublicAuthwitAction(data);
        }
        case ActionKind.Call: {
            return parseCallAction(data);
        }
        case ActionKind.EncodedCall: {
            return parseEncodedCallAction(data);
        }
        default: {
            throw new Error("Invalid action");
        }
    }
}

function parseAddCapsuleAction(data: any): AddCapsuleAction {
    return {
        kind: ActionKind.AddCapsule,
        contract: parseStringProp(data, "contract"),
        storageSlot: parseStringProp(data, "storageSlot"),
        capsule: parseArrayProp(data, "capsule", parseString),
    };
}

function parseAddPrivateAuthwitAction(data: any): AddPrivateAuthwitAction {
    return {
        kind: ActionKind.AddPrivateAuthwit,
        content: parseAuthwitContent(data.content),
        authwit: parseOptionalArrayProp(data, "authwit", parseString),
    };
}

function parseAddPublicAuthwitAction(data: any): AddPublicAuthwitAction {
    return {
        kind: ActionKind.AddPublicAuthwit,
        content: parseAuthwitContent(data.content),
    };
}

function parseCallAction(data: any): CallAction {
    return {
        kind: ActionKind.Call,
        contract: parseStringProp(data, "contract"),
        method: parseStringProp(data, "method"),
        args: parseArrayProp(data, "args"),
    };
}

function parseEncodedCallAction(data: any): EncodedCallAction {
    return {
        kind: ActionKind.EncodedCall,
        to: parseStringProp(data, "to"),
        name: parseOptionalStringProp(data, "name"),
        selector: parseStringProp(data, "selector"),
        type: parseOptionalStringProp(data, "type"),
        isStatic: parseOptionalBooleanProp(data, "isStatic"),
        args: parseArrayProp(data, "args", parseString),
        returnTypes: parseOptionalArrayProp(data, "returnTypes"),
    };
}

function parseAuthwitContent(data: any): AuthwitContent {
    switch (data?.kind) {
        case AuthwitContentKind.Call: {
            return parseCallAuthwitContent(data);
        }
        case AuthwitContentKind.EncodedCall: {
            return parseEncodedCallAuthwitContent(data);
        }
        case AuthwitContentKind.Intent: {
            return parseIntentAuthwitContent(data);
        }
        case AuthwitContentKind.MessageHash: {
            return parseMessageHashAuthwitContent(data);
        }
        default: {
            throw new Error("Invalid authwit content");
        }
    }
}

function parseCallAuthwitContent(data: any): CallAuthwitContent {
    return {
        kind: AuthwitContentKind.Call,
        caller: parseStringProp(data, "caller"),
        contract: parseStringProp(data, "contract"),
        method: parseStringProp(data, "method"),
        args: parseArrayProp(data, "args"),
    };
}

function parseEncodedCallAuthwitContent(data: any): EncodedCallAuthwitContent {
    return {
        kind: AuthwitContentKind.EncodedCall,
        caller: parseStringProp(data, "caller"),
        to: parseStringProp(data, "to"),
        name: parseOptionalStringProp(data, "name"),
        selector: parseStringProp(data, "selector"),
        type: parseOptionalStringProp(data, "type"),
        isStatic: parseOptionalBooleanProp(data, "isStatic"),
        args: parseArrayProp(data, "args", parseString),
        returnTypes: parseOptionalArrayProp(data, "returnTypes"),
    };
}

function parseIntentAuthwitContent(data: any): IntentAuthwitContent {
    return {
        kind: AuthwitContentKind.Intent,
        consumer: parseStringProp(data, "consumer"),
        intent: parseArrayProp(data, "intent", parseString),
    };
}

function parseMessageHashAuthwitContent(data: any): MessageHashAuthwitContent {
    return {
        kind: AuthwitContentKind.MessageHash,
        messageHash: parseStringProp(data, "messageHash"),
    };
}

function parseOptionalArrayProp<T>(data: any, prop: string, parseItem?: (item: any) => T): T[] | undefined {
    const value = data[prop];
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new Error(`Invalid ${prop}`);
    }
    return parseItem ? value.map(x => parseItem(x)) : value;
}

function parseArrayProp<T>(data: any, prop: string, parseItem?: (item: any) => T): T[] {
    const value = data[prop];
    if (!Array.isArray(value)) {
        throw new Error(`Invalid ${prop}`);
    }
    return parseItem ? value.map(x => parseItem(x)) : value;
}

function parseAccountProp(data: any, prop: string): CaipAccount {
    const value = data[prop];
    if (typeof value === "string") {
        const ss = value.split(":");
        if (ss.length === 3) {
            const [namespace, chainId] = ss;
            if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
                return value as CaipAccount;
            }
        }
    }
    throw new Error(`Invalid ${prop}`);
}

function parseChainProp(data: any, prop: string): CaipChain {
    const value = data[prop];
    if (typeof value === "string") {
        const ss = value.split(":");
        if (ss.length === 2) {
            const [namespace, chainId] = ss;
            if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
                return value as CaipChain;
            }
        }
    }
    throw new Error(`Invalid ${prop}`);
}

function parseChain(data: any): CaipChain {
    if (typeof data === "string") {
        const ss = data.split(":");
        if (ss.length === 2) {
            const [namespace, chainId] = ss;
            if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
                return data as CaipChain;
            }
        }
    }
    throw new Error("Invalid chain");
}

function parseOptionalBooleanProp(data: any, prop: string): boolean | undefined {
    const value = data[prop];
    if (value !== undefined && typeof value !== "boolean") {
        throw new Error(`Invalid ${prop}`);
    }
    return value;
}

function parseBooleanProp(data: any, prop: string): boolean {
    const value = data[prop];
    if (typeof value !== "boolean") {
        throw new Error(`Invalid ${prop}`);
    }
    return value;
}

function parseOptionalStringProp(data: any, prop: string): string | undefined {
    const value = data[prop];
    if (value !== undefined && typeof value !== "string") {
        throw new Error(`Invalid ${prop}`);
    }
    return value;
}

function parseStringProp(data: any, prop: string): string {
    const value = data[prop];
    if (typeof value !== "string") {
        throw new Error(`Invalid ${prop}`);
    }
    return value;
}

export function parseString(data: any, errorMessage?: string): string {
    if (typeof data !== "string") {
        throw new Error(errorMessage ?? "Invalid string value");
    }
    return data;
}

function parseRequiredProp(data: any, prop: string): unknown {
    const value = data[prop];
    if (value === undefined) {
        throw new Error(`Invalid ${prop}`);
    }
    return value;
}
