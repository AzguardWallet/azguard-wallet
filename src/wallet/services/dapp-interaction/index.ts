import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { DappSessionService } from "@/wallet/services/dapp-session";
import { DappSession } from "@/wallet/services/dapp-session/client";
import { getRandomHex, Lock } from "@/wallet/utils";
import {
    DAPP_INTERACTION_SERVICE_NAME, 
    GetInteractionPayloadRequest,
    ResolveInteractionRequest,
    RejectInteractionRequest,
    GetInteractionPayloadResponse,
    ResolveInteractionResponse,
    RejectInteractionResponse,
    DappInteractionServiceEvent,
    DappInteractionServiceEventMessage,
    DappInteractionServiceMethod,
    ConnectionPayload,
    ConnectionResult,  
    ExecutionPayload,
    ExecutionResult,
} from "./client";
import {
    ConnectionParams,
    ExecutionParams,
    OperationKind,
    AddNoteOperation,
    RegisterContractOperation,
    RegisterSenderOperation,
    SendTransactionOperation,
    SimulateTransactionOperation,
    SimulateUnconstrainedOperation, 
} from "./types";

type DappInteraction = {
    id: string,
    payload: ConnectionPayload | ExecutionPayload,
    resolve: (result: ConnectionResult | ExecutionResult) => void,
    reject: (reason: string) => void,
    cancellationToken: string,
};

export class DappInteractionService extends Service {
    private readonly storage: Map<string, DappInteraction> = new Map();
    private readonly lock = new Lock();

    public constructor(
        private readonly dappSessions: DappSessionService,
        emit: (event: EventMessage) => void
    ) {        
        super(DAPP_INTERACTION_SERVICE_NAME, emit);
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case DappInteractionServiceMethod.GetInteractionPayload: {
                const _request = request as GetInteractionPayloadRequest;
                try {
                    return new GetInteractionPayloadResponse(_request, this.getInteractionPayload(_request.interactionId));
                }
                catch (error: unknown) {
                    return new GetInteractionPayloadResponse(_request, undefined, (error as Error)?.message ?? "Unknown error");
                }
            }
            case DappInteractionServiceMethod.ResolveInteraction: {
                const _request = request as ResolveInteractionRequest;
                try {
                    this.resolveInteraction(_request.interactionId, _request.result);
                    return new ResolveInteractionResponse(_request);
                }
                catch (error: unknown) {
                    return new ResolveInteractionResponse(_request, (error as Error)?.message ?? "Unknown error");
                }
            }
            case DappInteractionServiceMethod.RejectInteraction: {
                const _request = request as RejectInteractionRequest;
                try {
                    this.rejectInteraction(_request.interactionId, _request.reason);
                    return new RejectInteractionResponse(_request);
                }
                catch (error: unknown) {
                    return new RejectInteractionResponse(_request, (error as Error)?.message ?? "Unknown error");
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    private getInteractionPayload(id: string): ConnectionPayload | ExecutionPayload {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        return interactionRequest.payload;
    }
    
    private resolveInteraction(id: string, result: ConnectionResult | ExecutionResult) {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        interactionRequest.resolve(result);
    }

    private rejectInteraction(id: string, reason: string) {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        interactionRequest.reject(reason);
    }

    public cancelInteraction(cancellationToken: string) {
        const interaction = this.storage.values().find(x => x.cancellationToken === cancellationToken);
        if (interaction) {
            this.emit(new DappInteractionServiceEventMessage(DappInteractionServiceEvent.InteractionCancelled, interaction.id));
        }
    }

    public async connect(params: ConnectionParams, cancellationToken?: string): Promise<ConnectionResult> {
        const payload: ConnectionPayload = {params}; 
        return await this.interaction("connect", payload, cancellationToken) as ConnectionResult;
    }

    public async execute(params: ExecutionParams, cancellationToken?: string): Promise<ExecutionResult> {
        const session = await this.validateSession(params);
        const payload: ExecutionPayload = {params, session};
        return await this.interaction("execute", payload, cancellationToken) as ExecutionResult;
    }

    private async interaction(
        type: string,
        payload: ConnectionPayload | ExecutionPayload,
        cancellationToken?: string,
    ): Promise<ConnectionResult | ExecutionResult> {
        let interaction: DappInteraction;
        let promise: Promise<ConnectionResult | ExecutionResult>;

        try {
            await this.lock.enter();

            let id: string;
            do { id = getRandomHex(8); }
            while (this.storage.has(id));

            interaction = {
                id,
                payload,
                resolve: null!,
                reject: null!,
                cancellationToken: cancellationToken ?? id,
            };

            promise = new Promise<ConnectionResult | ExecutionResult>((resolve, reject) => {
                interaction.resolve = resolve;
                interaction.reject = reject;
            });

            this.storage.set(id, interaction);
        }
        finally {
            this.lock.leave();
        }

        chrome.windows.create({
            type: 'popup',
            url: chrome.runtime.getURL(`src/popup/index.html#/windows/${type}?requestId=${interaction.id}`),
            height: 800,
            width: 400
        });

        return promise;
    }

    private async validateSession({sessionId, operations}: ExecutionParams): Promise<DappSession> {
        const session = await this.dappSessions.tryGetDappSession(sessionId);
        if (!session) {
            throw new Error("Invalid session");
        }
        for (const operation of operations) {
            switch (operation.kind) {
                case OperationKind.AddNote: {
                    const _operation = operation as AddNoteOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    break;
                }
                case OperationKind.RegisterContract: {
                    const _operation = operation as RegisterContractOperation;
                    this.checkMethodPermission(session, _operation.kind, _operation.chain);
                    break;
                }
                case OperationKind.RegisterSender: {
                    const _operation = operation as RegisterSenderOperation;
                    this.checkMethodPermission(session, _operation.kind, _operation.chain);
                    break;
                }
                case OperationKind.SendTransaction: {
                    const _operation = operation as SendTransactionOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    _operation.actions.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    _operation.setup?.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    break;
                }
                case OperationKind.SimulateTransaction: {
                    const _operation = operation as SimulateTransactionOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    _operation.actions.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    _operation.setup?.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    break;
                }
                case OperationKind.SimulateUnconstrained: {
                    const _operation = operation as SimulateUnconstrainedOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    break;
                }
            }
        }
        return session;
    }
    
    private checkAccountPermission(session: DappSession, account: string) {
        if (!session.accounts.includes(account)) {
            throw new Error("Unauthorized account");
        }
    }
    
    private checkMethodPermission(session: DappSession, method: string, chain: string) {
        if (!session.permissions.find(x => x.methods?.includes(method) && x.chains?.includes(chain))) {
            throw new Error("Unauthorized method/chain");
        }
    }
}