import { Fr } from "@aztec/foundation/fields";
import { Gas } from "@aztec/stdlib/gas";
import { IAction } from "@/wallet/services/execution/client";
import { FpcInfo } from "./client";
import { IFpcHandler } from "./handlers";

export class Fpc {
    public constructor(
        private readonly info: FpcInfo,
        private readonly handler: IFpcHandler,
    ) {}

    public getFeePayload(account: string, maxFee: Fr, inPublic?: boolean): IAction[] {
        return this.handler.getFeePayload(this.info, account, maxFee, inPublic);
    }

    public getTeardownGas(inPublic?: boolean): Gas {
        return this.handler.getTeardownGas(inPublic);
    }

    public getTotalGas(inPublic?: boolean): Gas {
        return this.handler.getTotalGas(inPublic);
    }
}
