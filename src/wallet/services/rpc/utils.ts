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
    AztecSimulateTxRequest,
    AztecSimulateUtilityRequest,
    AztecProfileTxRequest,
    AztecSendTxRequest,
    AztecGetContractClassMetadataRequest,
    AztecGetContractMetadataRequest,
    AztecRegisterContractRequest,
    AztecRegisterContractClassRequest,
    AztecProveTxRequest,
    AztecGetNodeInfoRequest,
    AztecGetPXEInfoRequest,
    AztecGetCurrentBaseFeesRequest,
    AztecUpdateContractRequest,
    AztecRegisterSenderRequest,
    AztecGetSendersRequest,
    AztecRemoveSenderRequest,
    AztecGetTxReceiptRequest,
    AztecGetPrivateEventsRequest,
    AztecGetPublicEventsRequest,
    AztecGetCompleteAddressRequest,
    AztecGetAddressRequest,
    AztecGetChainIdRequest,
    AztecGetVersionRequest,
    AztecCreateTxExecutionRequestRequest,
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
        case "aztec_simulateTx":
        case "aztec_simulateUtility":
        case "aztec_profileTx":
        case "aztec_sendTx":
        case "aztec_getContractClassMetadata":
        case "aztec_getContractMetadata":
        case "aztec_registerContract":
        case "aztec_registerContractClass":
        case "aztec_proveTx":
        case "aztec_getNodeInfo":
        case "aztec_getPXEInfo":
        case "aztec_getCurrentBaseFees":
        case "aztec_updateContract":
        case "aztec_registerSender":
        case "aztec_getSenders":
        case "aztec_removeSender":
        case "aztec_getTxReceipt":
        case "aztec_getPrivateEvents":
        case "aztec_getPublicEvents":
        case "aztec_getCompleteAddress":
        case "aztec_getAddress":
        case "aztec_getChainId":
        case "aztec_getVersion":
        case "aztec_createTxExecutionRequest":
        case "aztec_createAuthWit":
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
        case "aztec_simulateTx": {
            return parseAztecSimulateTxRequest(op);
        }
        case "aztec_simulateUtility": {
            return parseAztecSimulateUtilityRequest(op);
        }
        case "aztec_profileTx": {
            return parseAztecProfileTxRequest(op);
        }
        case "aztec_sendTx": {
            return parseAztecSendTxRequest(op);
        }
        case "aztec_getContractClassMetadata": {
            return parseAztecGetContractClassMetadataRequest(op);
        }
        case "aztec_getContractMetadata": {
            return parseAztecGetContractMetadataRequest(op);
        }
        case "aztec_registerContract": {
            return parseAztecRegisterContractRequest(op);
        }
        case "aztec_registerContractClass": {
            return parseAztecRegisterContractClassRequest(op);
        }
        case "aztec_proveTx": {
            return parseAztecProveTxRequest(op);
        }
        case "aztec_getNodeInfo": {
            return parseAztecGetNodeInfoRequest(op);
        }
        case "aztec_getPXEInfo": {
            return parseAztecGetPXEInfoRequest(op);
        }
        case "aztec_getCurrentBaseFees": {
            return parseAztecGetCurrentBaseFeesRequest(op);
        }
        case "aztec_updateContract": {
            return parseAztecUpdateContractRequest(op);
        }
        case "aztec_registerSender": {
            return parseAztecRegisterSenderRequest(op);
        }
        case "aztec_getSenders": {
            return parseAztecGetSendersRequest(op);
        }
        case "aztec_removeSender": {
            return parseAztecRemoveSenderRequest(op);
        }
        case "aztec_getTxReceipt": {
            return parseAztecGetTxReceiptRequest(op);
        }
        case "aztec_getPrivateEvents": {
            return parseAztecGetPrivateEventsRequest(op);
        }
        case "aztec_getPublicEvents": {
            return parseAztecGetPublicEventsRequest(op);
        }
        case "aztec_getCompleteAddress": {
            return parseAztecGetCompleteAddressRequest(op);
        }
        case "aztec_getAddress": {
            return parseAztecGetAddressRequest(op);
        }
        case "aztec_getChainId": {
            return parseAztecGetChainIdRequest(op);
        }
        case "aztec_getVersion": {
            return parseAztecGetVersionRequest(op);
        }
        case "aztec_createTxExecutionRequest": {
            return parseAztecCreateTxExecutionRequestRequest(op);
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

function parseAztecSimulateTxRequest(data: any): AztecSimulateTxRequest {
    return {
        kind: "aztec_simulateTx",
        chain: parseChainProp(data, "chain"),
        txRequest: parseRequiredProp(data, "txRequest"),
        simulatePublic: parseBooleanProp(data, "simulatePublic"),
        skipTxValidation: parseOptionalBooleanProp(data, "skipTxValidation"),
        skipFeeEnforcement: parseOptionalBooleanProp(data, "skipFeeEnforcement"),
        overrides: parseOptionalProp(data, "overrides"),
        scopes: parseOptionalArrayProp(data, "scopes"),
    };
}

function parseAztecSimulateUtilityRequest(data: any): AztecSimulateUtilityRequest {
    return {
        kind: "aztec_simulateUtility",
        chain: parseChainProp(data, "chain"),
        functionName: parseStringProp(data, "functionName"),
        args: parseArrayProp(data, "args"),
        to: parseRequiredProp(data, "to"),
        authwits: parseOptionalArrayProp(data, "authwits"),
        from: parseOptionalProp(data, "from"),
        scopes: parseOptionalArrayProp(data, "scopes"),
    };
}

function parseAztecProfileTxRequest(data: any): AztecProfileTxRequest {
    return {
        kind: "aztec_profileTx",
        chain: parseChainProp(data, "chain"),
        txRequest: parseRequiredProp(data, "txRequest"),
        profileMode: parseRequiredProp(data, "profileMode"),
        skipProofGeneration: parseOptionalBooleanProp(data, "skipProofGeneration"),
        msgSender: parseOptionalProp(data, "msgSender"),
    };
}

function parseAztecSendTxRequest(data: any): AztecSendTxRequest {
    return {
        kind: "aztec_sendTx",
        chain: parseChainProp(data, "chain"),
        tx: parseRequiredProp(data, "tx"),
    };
}

function parseAztecGetContractClassMetadataRequest(data: any): AztecGetContractClassMetadataRequest {
    return {
        kind: "aztec_getContractClassMetadata",
        chain: parseChainProp(data, "chain"),
        id: parseRequiredProp(data, "id"),
        includeArtifact: parseOptionalProp(data, "includeArtifact"),
    };
}

function parseAztecGetContractMetadataRequest(data: any): AztecGetContractMetadataRequest {
    return {
        kind: "aztec_getContractMetadata",
        chain: parseChainProp(data, "chain"),
        address: parseRequiredProp(data, "address"),
    };
}

function parseAztecRegisterContractRequest(data: any): AztecRegisterContractRequest {
    return {
        kind: "aztec_registerContract",
        chain: parseChainProp(data, "chain"),
        contract: {
            instance: parseRequiredProp(parseRequiredProp(data, "contract"), "instance"),
            artifact: parseOptionalProp(parseRequiredProp(data, "contract"), "artifact"),
        },
    };
}

function parseAztecRegisterContractClassRequest(data: any): AztecRegisterContractClassRequest {
    return {
        kind: "aztec_registerContractClass",
        chain: parseChainProp(data, "chain"),
        artifact: parseRequiredProp(data, "artifact"),
    };
}

function parseAztecProveTxRequest(data: any): AztecProveTxRequest {
    return {
        kind: "aztec_proveTx",
        chain: parseChainProp(data, "chain"),
        txRequest: parseRequiredProp(data, "txRequest"),
        privateExecutionResult: parseOptionalProp(data, "privateExecutionResult"),
    };
}

function parseAztecGetNodeInfoRequest(data: any): AztecGetNodeInfoRequest {
    return {
        kind: "aztec_getNodeInfo",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecGetPXEInfoRequest(data: any): AztecGetPXEInfoRequest {
    return {
        kind: "aztec_getPXEInfo",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecGetCurrentBaseFeesRequest(data: any): AztecGetCurrentBaseFeesRequest {
    return {
        kind: "aztec_getCurrentBaseFees",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecUpdateContractRequest(data: any): AztecUpdateContractRequest {
    return {
        kind: "aztec_updateContract",
        chain: parseChainProp(data, "chain"),
        contractAddress: parseRequiredProp(data, "contractAddress"),
        artifact: parseRequiredProp(data, "artifact"),
    };
}

function parseAztecRegisterSenderRequest(data: any): AztecRegisterSenderRequest {
    return {
        kind: "aztec_registerSender",
        chain: parseChainProp(data, "chain"),
        address: parseRequiredProp(data, "address"),
    };
}

function parseAztecGetSendersRequest(data: any): AztecGetSendersRequest {
    return {
        kind: "aztec_getSenders",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecRemoveSenderRequest(data: any): AztecRemoveSenderRequest {
    return {
        kind: "aztec_removeSender",
        chain: parseChainProp(data, "chain"),
        address: parseRequiredProp(data, "address"),
    };
}

function parseAztecGetTxReceiptRequest(data: any): AztecGetTxReceiptRequest {
    return {
        kind: "aztec_getTxReceipt",
        chain: parseChainProp(data, "chain"),
        txHash: parseRequiredProp(data, "txHash"),
    };
}

function parseAztecGetPrivateEventsRequest(data: any): AztecGetPrivateEventsRequest {
    return {
        kind: "aztec_getPrivateEvents",
        chain: parseChainProp(data, "chain"),
        contractAddress: parseRequiredProp(data, "contractAddress"),
        eventMetadata: parseRequiredProp(data, "eventMetadata"),
        from: parseNumberProp(data, "from"),
        numBlocks: parseNumberProp(data, "numBlocks"),
        recipients: parseArrayProp(data, "recipients"),
    };
}

function parseAztecGetPublicEventsRequest(data: any): AztecGetPublicEventsRequest {
    return {
        kind: "aztec_getPublicEvents",
        chain: parseChainProp(data, "chain"),
        eventMetadata: parseRequiredProp(data, "eventMetadata"),
        from: parseNumberProp(data, "from"),
        limit: parseNumberProp(data, "limit"),
    };
}

function parseAztecGetCompleteAddressRequest(data: any): AztecGetCompleteAddressRequest {
    return {
        kind: "aztec_getCompleteAddress",
        account: parseAccountProp(data, "account"),
    };
}

function parseAztecGetAddressRequest(data: any): AztecGetAddressRequest {
    return {
        kind: "aztec_getAddress",
        account: parseAccountProp(data, "account"),
    };
}

function parseAztecGetChainIdRequest(data: any): AztecGetChainIdRequest {
    return {
        kind: "aztec_getChainId",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecGetVersionRequest(data: any): AztecGetVersionRequest {
    return {
        kind: "aztec_getVersion",
        chain: parseChainProp(data, "chain"),
    };
}

function parseAztecCreateTxExecutionRequestRequest(data: any): AztecCreateTxExecutionRequestRequest {
    return {
        kind: "aztec_createTxExecutionRequest",
        account: parseAccountProp(data, "account"),
        exec: parseRequiredProp(data, "exec"),
        fee: parseRequiredProp(data, "fee"),
        options: parseRequiredProp(data, "options"),
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
