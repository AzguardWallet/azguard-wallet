import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import type { ExecutionService } from "@/wallet/services/execution";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex } from "@/wallet/utils";
import {
    type AddDappSessionRequest,
    AddDappSessionResponse,
    type DropDappSessionRequest,
    DropDappSessionResponse,
    type GetDappSessionRequest,
    GetDappSessionResponse,
    type GetDappSessionsRequest,
    GetDappSessionsResponse,
    type GetInteractionRequestRequest,
    GetInteractionRequestResponse,
    type DeleteInteractionRequestRequest,
    DeleteInteractionRequestResponse,
    InteractionRequest,
    Status,
    type GetDappSessionParams,
    DappSession,
    INTERACTION_SERVICE_NAME,
    InteractionServiceEvent,
    InteractionServiceEventMessage,
    InteractionServiceMethod,
} from "./client";
import type { Account } from "@/wallet/services/account/client/models";
import type { WCSessionParams } from "@/wallet/services/wallet-connect/client/models";
import type { IAction } from "@/wallet/services/execution/client/models";

type DappSessionDto = {
    name: string,
    params: WCSessionParams,
    profileId: string,
    chainIds: Array<number>,
    accounts: Array<Account>,
    url: string,
    icon: string,
}

type InteractionRequestDto = {
    status: Status,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    payload: Record<string, any>,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    result?: Record<string, any>,
}

export class InteractionService extends Service {
    private readonly dappSessions: EntityStorage<DappSessionDto>;
    private readonly interactionRequests: Map<string, InteractionRequestDto>;

    constructor(
        private readonly execution: ExecutionService,
        emit: (event: EventMessage) => void
    ) {        
        super(INTERACTION_SERVICE_NAME, emit);
        this.dappSessions = new EntityStorage("azguard:core:dappSessions", StorageType.Local);
        this.interactionRequests = new Map();
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case InteractionServiceMethod.GetDappSessions: {
                const _request = request as GetDappSessionsRequest;
                try {
                    return new GetDappSessionsResponse(_request, await this.getDappSessions(_request.profileId));
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new GetDappSessionsResponse(_request, undefined, error.message);
                    }

                    return new GetDappSessionsResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.GetDappSession: {
                const _request = request as GetDappSessionRequest;
                try {
                    const dappSession = await this.getDappSession(_request.getDappSessionParams);
                    return new GetDappSessionResponse(_request, dappSession);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new GetDappSessionResponse(_request, undefined, error.message);
                    }

                    return new GetDappSessionResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.AddDappSession: {
                const _request = request as AddDappSessionRequest
                try {
                    const dappSession = await this.addDappSession(_request.name, _request.params, _request.profileId, _request.chainIds, _request.accounts, _request.url, _request.icon)
                    this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappSessionAdded, dappSession))
                    return new AddDappSessionResponse(_request, dappSession)
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new AddDappSessionResponse(_request, undefined, error.message)
                    }

                    return new AddDappSessionResponse(_request, undefined, 'Unknown error occurred')
                }
            }
            case InteractionServiceMethod.DropDappSession: {
                const _request = request as DropDappSessionRequest;
                try {
                    const dappSession = await this.getDappSession({ id: _request.dappSessionId});
                    if (dappSession) {
                        await this.dropDappSession({ id: _request.dappSessionId });
                        this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappSessionDroped, dappSession));
                    }
                    return new DropDappSessionResponse(_request, dappSession);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new DropDappSessionResponse(_request, undefined, error.message);
                    }

                    return new DropDappSessionResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.GetInteractionRequest: {
                const _request = request as GetInteractionRequestRequest;
                try {
                    const interactionRequest = await this.getInteractionRequest(_request.requestId);
                    return new GetInteractionRequestResponse(_request, interactionRequest);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new GetInteractionRequestResponse(_request, undefined, error.message);
                    }

                    return new GetInteractionRequestResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.DeleteInteractionRequest: {
                const _request = request as DeleteInteractionRequestRequest;
                try {
                    const interactionRequest = await this.getInteractionRequest(_request.requestId);
                    if (interactionRequest) {
                        this.deleteInteractionRequest(_request.requestId);
                        return new DeleteInteractionRequestResponse(_request, true);
                    }
                    return new DeleteInteractionRequestResponse(_request, false);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new DeleteInteractionRequestResponse(_request, false, error.message);
                    }

                    return new DeleteInteractionRequestResponse(_request, false, 'Unknown error occurred');
                }
            }

            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async getInteractionRequest(id: string): Promise<InteractionRequest | undefined> {
        const interactionRequest = this.interactionRequests.get(id);
        return interactionRequest !== undefined ? new InteractionRequest(id, interactionRequest.status, interactionRequest.payload, interactionRequest.result) : undefined;
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async addInteractionRequest(payload: any): Promise<InteractionRequest> {
        return this._addInteractionRequest(payload);
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async _addInteractionRequest(payload: any): Promise<InteractionRequest> {
        let id: string
        do { id = getRandomHex(8) }
        while (this.interactionRequests.has(id))
        this.interactionRequests.set(id, {status: Status.Pending, payload: payload})
        
        return new InteractionRequest(id, Status.Pending, payload)
    }

    public deleteInteractionRequest(id: string): void {
        this.interactionRequests.delete(id);
    }

    public async getDappSessions(profileId: string): Promise<Array<DappSession>> {
        const dappSessions = await this.dappSessions.findByPredicate(ds => ds.profileId === profileId)
        if (!dappSessions) {
            return [];
        }
        return dappSessions.map(({ key, entity }) => new DappSession(key, entity.name, entity.params, entity.profileId, entity.chainIds, entity.accounts, entity.url, entity.icon))
    }


    public async getDappSession(params: GetDappSessionParams): Promise<DappSession | undefined> {
        const { id, topic } = params;
        let ds: DappSessionDto | undefined
        let key: string | undefined
        if (id) {
            key = id
            ds = await this.dappSessions.get(id)
        } else {
            const sessions = await this.dappSessions.getAll()
            
            const result = sessions.find(s => s[1].params.topic === topic)
            if (result) {
                key = result[0]
                ds = result[1]
            }
        }

        if (!ds || !key) {
            return undefined
        }

        return new DappSession(key, ds.name, ds.params, ds.profileId,  ds.chainIds, ds.accounts,ds.url, ds.icon)
    }
    
    public async addDappSession(
        name: string,
        params: WCSessionParams,
        profileId: string,
        chainIds: Array<number>,
        accounts: Array<Account>,
        url?: string,
        icon?: string,
        emit?: boolean
    ): Promise<DappSession> {
        const dappSession = await this._addDappSession(name, params, profileId, chainIds, accounts, url, icon)
        if (emit) {
            this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappSessionAdded, dappSession))
        }

        return dappSession
    }

    private async _addDappSession(
        name: string,
        params: WCSessionParams,
        profileId: string,
        chainIds: Array<number>,
        accounts: Array<Account>,
        url?: string,
        icon?: string
    ): Promise<DappSession> {
        let id: string;
        do { id = getRandomHex(8); }
        while (await this.dappSessions.contains(id));
        await this.dappSessions.set(id, {name, params, profileId, chainIds, accounts, url: url ?? '', icon: icon ?? ''});
        const dappSession = new DappSession(id, name, params, profileId, chainIds, accounts, url, icon);

        return dappSession
    }

    public async dropDappSession(params: GetDappSessionParams, emit?: boolean): Promise<void> {
        const { id, topic } = params
        let key: string | undefined

        if (id) {
            key = id
        } else if (topic) {
            const sessions = await this.dappSessions.getAll()
            const result = sessions.find(s => s[1].params.topic === topic)
            if (result) {
                key = result[0]
            }
        }

        if (!key) return

        if (emit) {
            const dappSession = await this.getDappSession({ id: key })
            if (dappSession) {
                this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappSessionDroped, dappSession))
            }
        }
        
        return this.dappSessions.delete(key)
    }
    
    public async executeDappSessionRequest(networkId: string, accountAddress: string, dappName: string, actions: IAction[], emit?: boolean): Promise<string> {
        try {
            const txHash = await this.execution.executeBatch(networkId, accountAddress, dappName, actions)

            return txHash
        }
        catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(error.message);
            }

            throw new Error("Unknown error occurred");
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async dappSessionProposal(payload: any): Promise<void> {
        await this._openWindow('session', payload)
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async dappSessionRequest(payload: any): Promise<void> {
        await this._openWindow('request', payload, 780)
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async _openWindow(name: string, payload: any, height?: number): Promise<void> {
        const interactionRequest = await this.addInteractionRequest(payload)
        const url = new URL(chrome.runtime.getURL(`src/popup/index.html#/windows/${name}`))
        url.searchParams.set('requestId', interactionRequest.id)

        chrome.windows.create({type: 'popup', url: url.toString(), height: height || 660, width: 400})
    }
}
