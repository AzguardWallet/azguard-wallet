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
    type DappMetadata,
    DappSession,
    INTERACTION_SERVICE_NAME,
    InteractionServiceEvent,
    InteractionServiceEventMessage,
    InteractionServiceMethod,
    type Namespaces,
    type ApproveInteractionRequestRequest,
    ApproveInteractionRequestResponse,
    type RejectInteractionRequestRequest,
    RejectInteractionRequestResponse,
    type BuildApprovedNamespacesRequest,
    BuildApprovedNamespacesResponse,
} from "./client";
import type { IAction } from "@/wallet/services/execution/client/models";

type DappSessionDto = {
    dappMetadata: DappMetadata,
    namespaces: Namespaces,
    expiry: number,
    profileId: string,
}

type InteractionRequestDto = {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    payload: Record<string, any>,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    resolve?: (value: any) => void,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    reject?: (reason?: any) => void,
    // promise: Promise<T>,
}

export class InteractionService extends Service {
    public readonly onDappSessionDroped: ((dappSession: DappSession) => void)[] = [];

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
                    const dappSession = await this.getDappSession(_request.sessionId);
                    return new GetDappSessionResponse(_request, dappSession);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new GetDappSessionResponse(_request, undefined, error.message);
                    }

                    return new GetDappSessionResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.BuildApprovedNamespaces: {
                const _request = request as BuildApprovedNamespacesRequest;
                try {
                    const approvedNamespaces = await this.buildApprovedNamespaces(_request.requiredNamespaces, _request.supportedNamespaces);
                    return new BuildApprovedNamespacesResponse(_request, approvedNamespaces);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new BuildApprovedNamespacesResponse(_request, undefined, error.message);
                    }

                    return new BuildApprovedNamespacesResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.AddDappSession: {
                const _request = request as AddDappSessionRequest
                try {
                    const dappSession = await this.addDappSession(_request.dappMetadata, _request.namespaces, _request.expiry, _request.profileId, _request.topic)
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
                    const dappSession = await this.getDappSession(_request.sessionId);
                    if (dappSession) {
                        await this.dropDappSession(_request.sessionId);
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
            case InteractionServiceMethod.ApproveInteractionRequest: {
                const _request = request as ApproveInteractionRequestRequest;
                try {
                    this.approveInteractionRequest(_request.requestId, _request.namespaces, _request.profileId);
                    return new RejectInteractionRequestResponse(_request, undefined);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new RejectInteractionRequestResponse(_request, undefined, error.message);
                    }

                    return new RejectInteractionRequestResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.RejectInteractionRequest: {
                const _request = request as RejectInteractionRequestRequest;
                try {
                    this.rejectInteractionRequest(_request.requestId, _request.reason);
                    return new RejectInteractionRequestResponse(_request, undefined);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new RejectInteractionRequestResponse(_request, undefined, error.message);
                    }

                    return new RejectInteractionRequestResponse(_request, undefined, 'Unknown error occurred');
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

        return interactionRequest !== undefined ? new InteractionRequest(id, interactionRequest.payload, interactionRequest.resolve, interactionRequest.reject) : undefined;
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async addInteractionRequest(payload: any): Promise<InteractionRequest> {
        return this._addInteractionRequest(payload);
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async _addInteractionRequest<T>(payload: any): Promise<InteractionRequest> {
        let id: string
        do { id = getRandomHex(8) }
        while (this.interactionRequests.has(id))

        this.interactionRequests.set(id, {payload})
        
        return new InteractionRequest(id, payload)
    }

    public approveInteractionRequest(id: string, namespaces: Namespaces, profileId: string): void {
        const interactionRequest = this.interactionRequests.get(id);

        if (interactionRequest?.resolve) {
            interactionRequest.resolve( { namespaces, profileId } )
        }

        this.deleteInteractionRequest(id)
    }

    public rejectInteractionRequest(id: string, reason?: string): void {
        const interactionRequest = this.interactionRequests.get(id);

        if (interactionRequest?.reject) {
            interactionRequest.reject(reason || "User rejected.")
        }

        this.deleteInteractionRequest(id)
    }

    public deleteInteractionRequest(id: string): void {
        this.interactionRequests.delete(id);
    }

    public async getDappSessions(profileId: string): Promise<Array<DappSession>> {
        const dappSessions = await this.dappSessions.findByPredicate(ds => ds.profileId === profileId)
        if (!dappSessions) {
            return [];
        }
        return dappSessions.map(({ key, entity }) => new DappSession(key, entity.dappMetadata, entity.namespaces, entity.expiry, entity.profileId))
    }


    public async getDappSession(id: string): Promise<DappSession | undefined> {
        const ds = await this.dappSessions.get(id);

        return ds !== undefined ? new DappSession(id, ds.dappMetadata, ds.namespaces, ds.expiry, ds.profileId) : undefined
    }
    
    public async addDappSession(
        dappMetadata: DappMetadata,
        namespaces: Namespaces,
        expiry: number,
        profileId: string,
        topic?: string,
        emit?: boolean,
    ): Promise<DappSession> {
        const dappSession = await this._addDappSession(dappMetadata, namespaces, expiry, profileId, topic)
        if (emit) {
            this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappSessionAdded, dappSession))
        }

        return dappSession
    }

    private async _addDappSession(
        dappMetadata: DappMetadata,
        namespaces: Namespaces,
        expiry: number,
        profileId: string,
        topic?: string,
    ): Promise<DappSession> {
        let id: string;
        if (topic) {
            id = topic
        } else {
            do { id = getRandomHex(8); }
            while (await this.dappSessions.contains(id));
        }

        for (const [key, ds] of await this.dappSessions.getAll()) {
            if (dappMetadata.name === ds.dappMetadata.name) {
                this.dropDappSession(key, true)
            }
        }
        
        await this.dappSessions.set(id, {dappMetadata, namespaces, expiry, profileId});
        const dappSession = new DappSession(id, dappMetadata, namespaces, expiry, profileId);

        return dappSession
    }

    public async dropDappSession(id: string, emit?: boolean): Promise<void> {
        const dappSession = await this.getDappSession(id)
        if (dappSession) {
            if (emit) {
                this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappSessionDroped, dappSession))
            }
            for (const emit of this.onDappSessionDroped) {
                try { emit(dappSession) } catch {}
            }
        }

        return this.dappSessions.delete(id)
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
    public async dappSessionProposal(payload: any): Promise<any> {
        return await this._openWindow('session', payload)
    }

    public async buildApprovedNamespaces(supportedNamespaces: Namespaces, requiredNamespaces: Namespaces, optionalNamespaces?: Namespaces): Promise<Namespaces> {
        const approvedNamespaces: Namespaces = {}

		for (const ns of Object.keys(requiredNamespaces)) {
			if (supportedNamespaces[ns]) {
                const chains = requiredNamespaces[ns].chains?.filter((ch: string) => supportedNamespaces[ns].chains?.includes(ch))
                const methods = requiredNamespaces[ns].methods.filter((m: string) => supportedNamespaces[ns].methods?.includes(m))
                const events = requiredNamespaces[ns].events?.filter((ev: string) => supportedNamespaces[ns].events?.includes(ev))
                approvedNamespaces[ns] = { chains, methods, events }

                if (optionalNamespaces?.[ns]) {
                    if (approvedNamespaces[ns].chains?.length && optionalNamespaces[ns].chains?.length) {
                        approvedNamespaces[ns].chains = [...new Set([...approvedNamespaces[ns].chains, ...optionalNamespaces[ns].chains])]
                    }
                    if (approvedNamespaces[ns].methods?.length && optionalNamespaces[ns].methods?.length) {
                        approvedNamespaces[ns].methods = [...new Set([...approvedNamespaces[ns].methods, ...optionalNamespaces[ns].methods])]
                    }
                    if (approvedNamespaces[ns].events?.length && optionalNamespaces[ns].events?.length) {
                        approvedNamespaces[ns].events = [...new Set([...approvedNamespaces[ns].events, ...optionalNamespaces[ns].events])]
                    }
                }
			}
		}

        return approvedNamespaces
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async dappSessionRequest(payload: any): Promise<any> {
        return await this._openWindow('request', payload, 780)
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async requestExpired(payload: any): Promise<void> {
        console.log('requestExpired');
        
        for (const ir of this.interactionRequests) {
            if (ir[1].payload?.id === payload.id) {
                console.log('requestExpired emit');
                
                this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.RequestExpired, new InteractionRequest(ir[0], ir[1].payload)))
                break
            }
        }
    }
    
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async _openWindow<T>(name: string, payload: any, height?: number): Promise<T> {
        const interactionRequest = await this.addInteractionRequest(payload)

        const promise = new Promise<T>((resolve, reject) => {
            this.interactionRequests.set(interactionRequest.id, { payload: interactionRequest.payload, resolve, reject });
        });

        const url = new URL(chrome.runtime.getURL(`src/popup/index.html#/windows/${name}`))
        url.searchParams.set('requestId', interactionRequest.id)

        chrome.windows.create({type: 'popup', url: url.toString(), height: height || 660, width: 400})

        return promise
    }
}
