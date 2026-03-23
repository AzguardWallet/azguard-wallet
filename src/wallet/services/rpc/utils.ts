import { DappMetadata, DappPermissions } from "@/wallet/services/dapp-session/spec";
import {
    Action,
    ActionKind,
    OperationKind,
    AddCapsuleAction,
    AddExtraArgsAction,
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
    AztecGetContractClassMetadataRequest,
    AztecGetContractMetadataRequest,
    AztecGetPrivateEventsRequest,
    AztecGetChainInfoRequest,
    AztecRegisterSenderRequest,
    AztecGetAddressBookRequest,
    AztecGetAccountsRequest,
    AztecRegisterContractRequest,
    AztecSimulateTxRequest,
    AztecExecuteUtilityRequest,
    AztecProfileTxRequest,
    AztecSendTxRequest,
    AztecCreateAuthWitRequest,
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
        ...(data.source && { source: data.source }),
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
        case "aztec_getContractClassMetadata":
        case "aztec_getContractMetadata":
        case "aztec_getPrivateEvents":
        case "aztec_getChainInfo":
        case "aztec_registerSender":
        case "aztec_getAddressBook":
        case "aztec_getAccounts":
        case "aztec_registerContract":
        case "aztec_simulateTx":
        case "aztec_executeUtility":
        case "aztec_profileTx":
        case "aztec_sendTx":
        case "aztec_createAuthWit":
        // actions
        case "add_capsule":
        case "add_extra_args":
        case "add_private_authwit":
        case "add_public_authwit":
        case "call":
        case "encoded_call":
            return data;
        default:
            throw new Error(`Invalid method: ${JSON.stringify(data)}`);
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
        case "aztec_getContractClassMetadata": {
            return parseAztecGetContractClassMetadataRequest(op);
        }
        case "aztec_getContractMetadata": {
            return parseAztecGetContractMetadataRequest(op);
        }
        case "aztec_getPrivateEvents": {
            return parseAztecGetPrivateEventsRequest(op);
        }
        case "aztec_getChainInfo": {
            return parseAztecGetChainInfoRequest(op);
        }
        case "aztec_registerSender": {
            return parseAztecRegisterSenderRequest(op);
        }
        case "aztec_getAddressBook": {
            return parseAztecGetAddressBookRequest(op);
        }
        case "aztec_getAccounts": {
            return parseAztecGetAccountsRequest(op);
        }
        case "aztec_registerContract": {
            return parseAztecRegisterContractRequest(op);
        }
        case "aztec_simulateTx": {
            return parseAztecSimulateTxRequest(op);
        }
        case "aztec_executeUtility": {
            return parseAztecExecuteUtilityRequest(op);
        }
        case "aztec_profileTx": {
            return parseAztecProfileTxRequest(op);
        }
        case "aztec_sendTx": {
            return parseAztecSendTxRequest(op);
        }
        case "aztec_createAuthWit": {
            return parseAztecCreateAuthWitRequest(op);
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
        fee: parseOptionalProp(data, "fee"),
    };
}

function parseSimulateTransactionRequest(data: any): SimulateTransactionRequest {
    return {
        kind: "simulate_transaction",
        account: parseAccountProp(data, "account"),
        actions: parseArrayProp(data, "actions", parseAction),
        fee: parseOptionalProp(data, "fee"),
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

function parseAztecGetContractClassMetadataRequest(data: any): AztecGetContractClassMetadataRequest {
    return {
        kind: "aztec_getContractClassMetadata",
        chain: parseChainProp(data, "chain"),
        id: parseRequiredProp(data, "id"),
    };
}

function parseAztecGetContractMetadataRequest(data: any): AztecGetContractMetadataRequest {
    return {
        kind: "aztec_getContractMetadata",
        chain: parseChainProp(data, "chain"),
        address: parseRequiredProp(data, "address"),
    };
}

function parseAztecGetPrivateEventsRequest(data: any): AztecGetPrivateEventsRequest {
    return {
        kind: "aztec_getPrivateEvents",
        chain: parseChainProp(data, "chain"),
        eventMetadata: parseRequiredProp(data, "eventMetadata"),
        eventFilter: parseRequiredProp(data, "eventFilter"),
    };
}

function parseAztecGetChainInfoRequest(data: any): AztecGetChainInfoRequest {
    return {
        kind: "aztec_getChainInfo",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecRegisterSenderRequest(data: any): AztecRegisterSenderRequest {
    return {
        kind: "aztec_registerSender",
        chain: parseChainProp(data, "chain"),
        address: parseRequiredProp(data, "address"),
    };
}

function parseAztecGetAddressBookRequest(data: any): AztecGetAddressBookRequest {
    return {
        kind: "aztec_getAddressBook",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecGetAccountsRequest(data: any): AztecGetAccountsRequest {
    return {
        kind: "aztec_getAccounts",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecRegisterContractRequest(data: any): AztecRegisterContractRequest {
    return {
        kind: "aztec_registerContract",
        chain: parseChainProp(data, "chain"),
        instance: parseRequiredProp(data, "instance"),
        artifact: parseOptionalProp(data, "artifact"),
        secretKey: parseOptionalProp(data, "secretKey"),
    };
}

function parseAztecSimulateTxRequest(data: any): AztecSimulateTxRequest {
    return {
        kind: "aztec_simulateTx",
        account: parseAccountProp(data, "account"),
        exec: parseRequiredProp(data, "exec"),
        opts: parseRequiredProp(data, "opts"),
    };
}

function parseAztecExecuteUtilityRequest(data: any): AztecExecuteUtilityRequest {
    return {
        kind: "aztec_executeUtility",
        account: parseAccountProp(data, "account"),
        call: parseRequiredProp(data, "call"),
        opts: parseRequiredProp(data, "opts"),
    };
}

function parseAztecProfileTxRequest(data: any): AztecProfileTxRequest {
    return {
        kind: "aztec_profileTx",
        account: parseAccountProp(data, "account"),
        exec: parseRequiredProp(data, "exec"),
        opts: parseRequiredProp(data, "opts"),
    };
}

function parseAztecSendTxRequest(data: any): AztecSendTxRequest {
    return {
        kind: "aztec_sendTx",
        account: parseAccountProp(data, "account"),
        exec: parseRequiredProp(data, "exec"),
        opts: parseRequiredProp(data, "opts"),
    };
}

function parseAztecCreateAuthWitRequest(data: any): AztecCreateAuthWitRequest {
    return {
        kind: "aztec_createAuthWit",
        account: parseAccountProp(data, "account"),
        messageHashOrIntent: parseRequiredProp(data, "messageHashOrIntent"),
    };
}

function parseAction(data: Action): Action {
    switch (data?.kind) {
        case "add_capsule": {
            return parseAddCapsuleAction(data);
        }
        case "add_extra_args": {
            return parseAddExtraArgsAction(data);
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

function parseAddExtraArgsAction(data: any): AddExtraArgsAction {
    return {
        kind: "add_extra_args",
        args: parseArrayProp(data, "args", parseString),
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
        hideSender: parseOptionalBooleanProp(data, "hideSender"),
    };
}

function parseEncodedCallAction(data: any): EncodedCallAction {
    return {
        kind: "encoded_call",
        to: parseStringProp(data, "to"),
        name: parseOptionalStringProp(data, "name"),
        selector: parseStringProp(data, "selector"),
        type: parseOptionalStringProp(data, "type"),
        hideMsgSender: parseOptionalBooleanProp(data, "hideMsgSender"),
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
        hideSender: parseOptionalBooleanProp(data, "hideSender"),
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
        hideMsgSender: parseOptionalBooleanProp(data, "hideMsgSender"),
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

function parseNumberProp(data: any, prop: string): number {
    const value = data[prop];
    if (typeof value !== "number") {
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

function parseRequiredProp<T>(data: any, prop: string): T {
    const value = data[prop];
    if (value === undefined) {
        throw new Error(`Invalid ${prop}`);
    }
    return value;
}

function parseOptionalProp<T>(data: any, prop: string): T | undefined {
    const value = data[prop];
    if (value === undefined) {
        return undefined;
    }
    return value;
}
