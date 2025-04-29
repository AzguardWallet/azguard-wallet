import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { DappSessionService } from "@/wallet/services/dapp-session";
import { DappSession } from "@/wallet/services/dapp-session/client";
import { DappInteractionService } from "@/wallet/services/dapp-interaction";
import {
    ConnectionParams,
    ExecutionParams,
    DappSessionInfo,
    OperationResult,    
} from "@/wallet/services/dapp-interaction/types";
import {
    RPC_SERVICE_NAME,
    InvokeRequest,
    InvokeResponse,
    RpcServiceEventMessage,
    RpcServiceMethod,
} from "./client";
import {
    WalletInfo,
    AzguardWalletInfo,
    RpcEvent,
    RpcMethod,
} from "./types";
import { parseConnectionParams, parseExecutionParams, parseString } from "./utils";

export class RpcService extends Service {
    constructor(
        private readonly dappSessions: DappSessionService,
        private readonly dappInteractions: DappInteractionService,
        emit: (event: EventMessage) => void
    ) {        
        super(RPC_SERVICE_NAME, emit);
        this.dappSessions.onDappSessionUpdated.push(this.onDappSessionUpdated);
        this.dappSessions.onDappSessionDeleted.push(this.onDappSessionDeleted);
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case RpcServiceMethod.Invoke: {
                const _request = request as InvokeRequest;
                try {
                    const result = await this.invoke(_request.fn, _request.args);
                    return new InvokeResponse(_request, result)
                }
                catch (error) {
                    return new InvokeResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async invoke(method: string, params: any): Promise<[string, any]> {
        switch (method) {
            case RpcMethod.get_wallet_info: {
                return this.getWalletInfo();
            }
            case RpcMethod.get_session: {
                return await this.getSession(parseString(params, "Invalid session id"));
            }
            case RpcMethod.close_session: {
                return await this.closeSession(parseString(params, "Invalid session id"));
            }
            case RpcMethod.connect: {
                return await this.connect(parseConnectionParams(params));
            }
            case RpcMethod.execute: {
                return await this.execute(parseExecutionParams(params));
            }
            default: {
                throw new Error("Unsupported method");
            }
        }
    }

    public getWalletInfo(): [string, WalletInfo] {
        return ["", AzguardWalletInfo];
    }

    public async getSession(id: string): Promise<[string, DappSessionInfo | null]> {
        try {
            const session = await this.dappSessions.getDappSession(id);
            return [session.id, this.sessionInfo(session)];
        }
        catch {
            return ["", null];
        }
    }

    public async closeSession(id: string): Promise<[string, DappSessionInfo | null]> {
        try {
            const session = await this.dappSessions.deleteDappSession(id);
            return [session.id, this.sessionInfo(session)];
        }
        catch {
            return ["", null];
        }
    }

    public async connect(params: ConnectionParams): Promise<[string, DappSessionInfo]> {
        const session = await this.dappInteractions.connect(params);
        return [session.id, session];
    }

    public async execute(params: ExecutionParams): Promise<[string, OperationResult[]]> {
        const operationResults = await this.dappInteractions.execute(params);
        return [params.sessionId, operationResults];
    }
    
    private readonly onDappSessionUpdated = async (session: DappSession) => {
        this.emit(new RpcServiceEventMessage(
            RpcEvent.session_updated,
            [session.id, this.sessionInfo(session)],
        ));
    }
    
    private readonly onDappSessionDeleted = async (session: DappSession) => {
        this.emit(new RpcServiceEventMessage(
            RpcEvent.session_closed,
            [session.id, this.sessionInfo(session)],
        ));
    }

    private sessionInfo(session: DappSession): DappSessionInfo {
        return {
            id: session.id,
            permissions: session.permissions,
            accounts: session.accounts,
        }
    }
}