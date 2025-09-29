import { DappMetadata, DappPermissions } from "@/wallet/services/dapp-session/spec";
import {
    Action,
    ActionKind,
    OperationKind,
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
} from "@/wallet/services/execution/models";
import {
    ConnectionParams,
    ExecutionParams,
    CaipChain,
    CaipAccount,
    OperationRequest,
    GetCompleteAddressRequest,
    RegisterContractRequest,
    RegisterSenderRequest,
    RegisterTokenRequest,
    SendTransactionRequest,
    SimulateTransactionRequest,
    SimulateUtilityRequest,
    SimulateViewsRequest,
} from "@/wallet/services/dapp-interaction/spec";
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

export function parseMethod(data: OperationKind | ActionKind): string {
    switch (data) {
        // rpc methods
        // case RpcMethod.get_wallet_info:
        // case RpcMethod.get_session:
        // case RpcMethod.close_session:
        // case RpcMethod.connect:
        // case RpcMethod.execute:
        // operations
        case "get_complete_address":
        case "register_sender":
        case "register_token":
        case "register_contract":
        case "send_transaction":
        case "simulate_transaction":
        case "simulate_utility":
        case "simulate_views":
        // actions
        case "add_capsule":
        case "add_private_authwit":
        case "add_public_authwit":
        case "call":
        case "encoded_call":
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

function parseOperation(op: OperationRequest): OperationRequest {
    switch (op?.kind) {
        case "get_complete_address": {
            return parseGetCompleteAddressRequest(op);
        }
        case "register_contract": {
            return parseRegisterContractRequest(op);
        }
        case "register_sender": {
            return parseRegisterSenderRequest(op);
        }
        case "register_token": {
            return parseRegisterTokenRequest(op);
        }
        case "send_transaction": {
            return parseSendTransactionRequest(op);
        }
        case "simulate_transaction": {
            return parseSimulateTransactionRequest(op);
        }
        case "simulate_utility": {
            return parseSimulateUtilityRequest(op);
        }
        case "simulate_views": {
            return parseSimulateViewsRequest(op);
        }
        default: {
            throw new Error("Invalid operation");
        }
    }
}

function parseGetCompleteAddressRequest(data: any): GetCompleteAddressRequest {
    return {
        kind: "get_complete_address",
        account: parseAccountProp(data, "account"),
    };
}

function parseRegisterContractRequest(data: any): RegisterContractRequest {
    return {
        kind: "register_contract",
        chain: parseChainProp(data, "chain"),
        address: parseStringProp(data, "address"),
        instance: data.instance, // TODO: implement validation
        artifact: data.artifact, // TODO: implement validation
    };
}

function parseRegisterSenderRequest(data: any): RegisterSenderRequest {
    return {
        kind: "register_sender",
        chain: parseChainProp(data, "chain"),
        address: parseStringProp(data, "address"),
    };
}

function parseRegisterTokenRequest(data: any): RegisterTokenRequest {
    return {
        kind: "register_token",
        account: parseAccountProp(data, "account"),
        address: parseStringProp(data, "address"),
    };
}

function parseSendTransactionRequest(data: any): SendTransactionRequest {
    return {
        kind: "send_transaction",
        account: parseAccountProp(data, "account"),
        actions: parseArrayProp(data, "actions", parseAction),
        setup: parseOptionalArrayProp(data, "setup", parseAction),
    };
}

function parseSimulateTransactionRequest(data: any): SimulateTransactionRequest {
    return {
        kind: "simulate_transaction",
        account: parseAccountProp(data, "account"),
        actions: parseArrayProp(data, "actions", parseAction),
        setup: parseOptionalArrayProp(data, "setup", parseAction),
        simulatePublic: parseOptionalBooleanProp(data, "simulatePublic"),
    };
}

function parseSimulateUtilityRequest(data: any): SimulateUtilityRequest {
    return {
        kind: "simulate_utility",
        account: parseAccountProp(data, "account"),
        contract: parseStringProp(data, "contract"),
        method: parseStringProp(data, "method"),
        args: parseArrayProp(data, "args"),
    };
}

function parseSimulateViewsRequest(data: any): SimulateViewsRequest {
    return {
        kind: "simulate_views",
        account: parseAccountProp(data, "account"),
        calls: parseArrayProp(data, "calls", parseAction).filter(x => x.kind === "call" || x.kind === "encoded_call"),
    };
}

function parseAction(data: Action): Action {
    switch (data?.kind) {
        case "add_capsule": {
            return parseAddCapsuleAction(data);
        }
        case "add_private_authwit": {
            return parseAddPrivateAuthwitAction(data);
        }
        case "add_public_authwit": {
            return parseAddPublicAuthwitAction(data);
        }
        case "call": {
            return parseCallAction(data);
        }
        case "encoded_call": {
            return parseEncodedCallAction(data);
        }
        default: {
            throw new Error("Invalid action");
        }
    }
}

function parseAddCapsuleAction(data: any): AddCapsuleAction {
    return {
        kind: "add_capsule",
        contract: parseStringProp(data, "contract"),
        storageSlot: parseStringProp(data, "storageSlot"),
        capsule: parseArrayProp(data, "capsule", parseString),
    };
}

function parseAddPrivateAuthwitAction(data: any): AddPrivateAuthwitAction {
    return {
        kind: "add_private_authwit",
        content: parseAuthwitContent(data.content),
        authwit: parseOptionalArrayProp(data, "authwit", parseString),
    };
}

function parseAddPublicAuthwitAction(data: any): AddPublicAuthwitAction {
    return {
        kind: "add_public_authwit",
        content: parseAuthwitContent(data.content),
    };
}

function parseCallAction(data: any): CallAction {
    return {
        kind: "call",
        contract: parseStringProp(data, "contract"),
        method: parseStringProp(data, "method"),
        args: parseArrayProp(data, "args"),
    };
}

function parseEncodedCallAction(data: any): EncodedCallAction {
    return {
        kind: "encoded_call",
        to: parseStringProp(data, "to"),
        name: parseOptionalStringProp(data, "name"),
        selector: parseStringProp(data, "selector"),
        type: parseOptionalStringProp(data, "type"),
        isStatic: parseOptionalBooleanProp(data, "isStatic"),
        args: parseArrayProp(data, "args", parseString),
        returnTypes: parseOptionalArrayProp(data, "returnTypes"),
    };
}

function parseAuthwitContent(data: AuthwitContent): AuthwitContent {
    switch (data?.kind) {
        case "call": {
            return parseCallAuthwitContent(data);
        }
        case "encoded_call": {
            return parseEncodedCallAuthwitContent(data);
        }
        case "intent": {
            return parseIntentAuthwitContent(data);
        }
        case "message_hash": {
            return parseMessageHashAuthwitContent(data);
        }
        default: {
            throw new Error("Invalid authwit content");
        }
    }
}

function parseCallAuthwitContent(data: any): CallAuthwitContent {
    return {
        kind: "call",
        caller: parseStringProp(data, "caller"),
        contract: parseStringProp(data, "contract"),
        method: parseStringProp(data, "method"),
        args: parseArrayProp(data, "args"),
    };
}

function parseEncodedCallAuthwitContent(data: any): EncodedCallAuthwitContent {
    return {
        kind: "encoded_call",
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
        kind: "intent",
        consumer: parseStringProp(data, "consumer"),
        intent: parseArrayProp(data, "intent", parseString),
    };
}

function parseMessageHashAuthwitContent(data: any): MessageHashAuthwitContent {
    return {
        kind: "message_hash",
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
