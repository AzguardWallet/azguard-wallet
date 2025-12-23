import type { Fr } from "@aztec/foundation/curves/bn254";
import type { Gas } from "@aztec/stdlib/gas";
import type { Action } from "@/wallet/services/execution/spec";
import type { FpcInfo } from "./spec";
import type { IFpcHandler } from "./handlers";

export class Fpc {
    public constructor(
        private readonly info: FpcInfo,
        private readonly handler: IFpcHandler,
    ) {}

    public get infoData(): FpcInfo {
        return this.info;
    }

    public getFeePayload(account: string, maxFee: Fr, inPublic?: boolean): Action[] {
        return this.handler.getFeePayload(this.info, account, maxFee, inPublic);
    }

    public getTeardownGas(inPublic?: boolean): Gas {
        return this.handler.getTeardownGas(inPublic);
    }

    public getTotalGas(inPublic?: boolean): Gas {
        return this.handler.getTotalGas(inPublic);
    }
}
