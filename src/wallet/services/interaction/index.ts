import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex } from "@/wallet/utils";
import {
    type AddDappRequest,
    AddDappResponse,
    type DeleteDappRequest,
    DeleteDappResponse,
    type GetDappRequest,
    GetDappResponse,
    type GetDappsRequest,
    GetDappsResponse,
    Dapp,
    INTERACTION_SERVICE_NAME,
    InteractionServiceEvent,
    InteractionServiceEventMessage,
    InteractionServiceMethod,
} from "./client";

type DappDto = {
    name: string,
}

export class InteractionService extends Service {
    private readonly dapps: EntityStorage<DappDto>;

    constructor(emit: (event: EventMessage) => void) {
        super(INTERACTION_SERVICE_NAME, emit);
        this.dapps = new EntityStorage("azguard:core:dapps", StorageType.Local);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case InteractionServiceMethod.GetDapps: {
                const _request = request as GetDappsRequest;
                try {
                    return new GetDappsResponse(_request, await this.getDapps());
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new GetDappsResponse(_request, undefined, error.message);
                    }

                    return new GetDappsResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.GetDapp: {
                const _request = request as GetDappRequest;
                try {
                    const network = await this.getDapp(_request.dappid);
                    return new GetDappResponse(_request);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new GetDappResponse(_request, undefined, error.message);
                    }

                    return new GetDappResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.AddDapp: {
                const _request = request as AddDappRequest;
                try {
                    const network = await this.addDapp(_request.name);
                    this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappAdded, network));
                    return new AddDappResponse(_request, network);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new AddDappResponse(_request, undefined, error.message);
                    }

                    return new AddDappResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case InteractionServiceMethod.DeleteDapp: {
                const _request = request as DeleteDappRequest;
                try {
                    const dapp = await this.getDapp(_request.dappId);
                    if (dapp) {
                        await this.deleteDapp(_request.dappId);
                        this.emit(new InteractionServiceEventMessage(InteractionServiceEvent.DappDeleted, dapp));
                    }
                    return new DeleteDappResponse(_request, dapp);
                }
                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new DeleteDappResponse(_request, undefined, error.message);
                    }

                    return new DeleteDappResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async getDapps(): Promise<Array<Dapp>> {
        const dapps = await this.dapps.getAll();
        if (dapps.length === 0) {
            return [];
        }
        return dapps.map(([id, dto]) => new Dapp(id, dto.name));
    }

    public async getDapp(id: string): Promise<Dapp | undefined> {
        const dapp = await this.dapps.get(id);
        return dapp !== undefined ? new Dapp(id, dapp.name) : undefined;
    }

    public async addDapp(name: string): Promise<Dapp> {
        return this._addDapp(name);
    }

    public deleteDapp(id: string): Promise<void> {
        return this.dapps.delete(id);
    }

    private async _addDapp(name: string): Promise<Dapp> {
        let id: string;
        do { id = getRandomHex(8); }
        while (await this.dapps.contains(id));
        await this.dapps.set(id, {name});
        return new Dapp(id, name);
    }
}
