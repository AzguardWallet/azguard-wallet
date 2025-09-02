import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { DappSessionService, DappSession } from "@/wallet/services/dapp-session/service";
import {
    DappInteractionService,
    ConnectionParams,
    ExecutionParams,
    DappSessionInfo,
    OperationResult,
} from "@/wallet/services/dapp-interaction/service";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Events, Methods, GenericRpcEvent, RPC_SERVICE_NAME } from "./spec";
import { type WalletInfo, AzguardWalletInfo, RpcEvent, RpcMethod } from "./types";
import { parseConnectionParams, parseExecutionParams, parseString } from "./utils";

export * from "./spec";

export class RpcService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = RPC_SERVICE_NAME;

    public readonly onGenericEvent = new EventHandler<GenericRpcEvent>();

    private dappSessions: DappSessionService = null!;
    private dappInteractions: DappInteractionService = null!;

    public constructor(logger: ILogger) {
        super(RPC_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.dappSessions = services.get(DappSessionService.name);
        this.dappInteractions = services.get(DappInteractionService.name);
        this.dappSessions.onDappSessionUpdated.add(this.onDappSessionUpdated);
        this.dappSessions.onDappSessionDeleted.add(this.onDappSessionDeleted);
    }

    public async invoke(method: string, params: any): Promise<[string, any]> {
        await this.ensureInitialized();
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

    private getWalletInfo(): [string, WalletInfo] {
        return ["", AzguardWalletInfo];
    }

    private async getSession(id: string): Promise<[string, DappSessionInfo | null]> {
        try {
            const session = await this.dappSessions.getDappSession(id);
            return [session.id, this.sessionInfo(session)];
        } catch {
            return ["", null];
        }
    }

    private async closeSession(id: string): Promise<[string, DappSessionInfo | null]> {
        try {
            const session = await this.dappSessions.deleteDappSession(id);
            return [session.id, this.sessionInfo(session)];
        } catch {
            return ["", null];
        }
    }

    private async connect(params: ConnectionParams): Promise<[string, DappSessionInfo]> {
        const session = await this.dappInteractions.connect(params);
        return [session.id, session];
    }

    private async execute(params: ExecutionParams): Promise<[string, OperationResult[]]> {
        const operationResults = await this.dappInteractions.execute(params);
        return [params.sessionId, operationResults];
    }

    private readonly onDappSessionUpdated = async (session: DappSession) => {
        this.emit("onGenericEvent", {
            event: RpcEvent.session_updated,
            payload: [session.id, this.sessionInfo(session)],
        });
    };

    private readonly onDappSessionDeleted = async (session: DappSession) => {
        this.emit("onGenericEvent", {
            event: RpcEvent.session_closed,
            payload: [session.id, this.sessionInfo(session)],
        });
    };

    private sessionInfo(session: DappSession): DappSessionInfo {
        return {
            id: session.id,
            permissions: session.permissions,
            accounts: session.accounts,
        };
    }
}
