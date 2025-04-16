import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import type { FeeSettings } from "@/wallet/services/execution/client";
import { FAUCET_SERVICE_NAME } from ".";

export enum FaucetServiceMethod {
    Mint,
}

export class MintRequest extends RequestMessage {

    constructor(
        public readonly network: string,
        public readonly account: string,
        public readonly name: string,
        public readonly symbol: string,
        public readonly decimals: number,
        public readonly amount: string,
        public readonly feeSettings: FeeSettings,
    ) {
        super(FAUCET_SERVICE_NAME, FaucetServiceMethod.Mint);
    }
}

export class MintResponse extends ResponseMessage {
    constructor(
        request: MintRequest,
        error?: string,
    ) {
        super(FAUCET_SERVICE_NAME, request.id, undefined, error);
    }
}
