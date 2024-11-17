import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { type Dapp, INTERACTION_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum InteractionServiceMethod {
    GetDapps,
    GetDapp,
    AddDapp,
    DeleteDapp,
}

export class GetDappsRequest extends RequestMessage {
    constructor() {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.GetDapps);
    }
}

export class GetDappsResponse extends ResponseMessage {
    constructor(
        request: GetDappsRequest,
        result?: Dapp[],
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class GetDappRequest extends RequestMessage {
    constructor(
        public readonly dappid: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.GetDapp);
    }
}

export class GetDappResponse extends ResponseMessage {
    constructor(
        request: GetDappRequest,
        result?: Dapp,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class AddDappRequest extends RequestMessage {
    constructor(
        public readonly name: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.AddDapp);
    }
}

export class AddDappResponse extends ResponseMessage {
    constructor(
        request: AddDappRequest,
        result?: Dapp,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class DeleteDappRequest extends RequestMessage {
    constructor(
        public readonly dappId: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.DeleteDapp);
    }
}

export class DeleteDappResponse extends ResponseMessage {
    constructor(
        request: DeleteDappRequest,
        result?: Dapp,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}
