import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { TransferType, TxOrigin } from "@/wallet/services/transaction/service";
import { EXECUTION_SERVICE_NAME, FeeSettings, Operation, OperationResult, Methods } from "./spec";

export * from "./spec";

export class ExecutionServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(name?: string) {
        super(EXECUTION_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public executeTransfer(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): Promise<string> {
        return this.request(
            "executeTransfer",
            networkId,
            accountAddress,
            tokenId,
            transferType,
            recipientAddress,
            amount,
            feeSettings,
        );
    }

    public executeOperations(operations: Operation[], origin: TxOrigin): Promise<OperationResult[]> {
        return this.request("executeOperations", operations, origin);
    }
}
