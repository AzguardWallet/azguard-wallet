import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { TransferType, LocalTxOrigin } from "@/wallet/services/transaction/service";
import { EXECUTION_SERVICE_NAME, FeeSettings, GasBalances, TransferFeeEstimate, Operation, OperationResult, Methods } from "./spec";

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

    public executeOperations(operations: Operation[], origin: LocalTxOrigin): Promise<OperationResult[]> {
        return this.request("executeOperations", operations, origin);
    }

    public getGasBalances(networkId: string, accountAddress: string, forceRefresh?: boolean): Promise<GasBalances> {
        return this.request("getGasBalances", networkId, accountAddress, forceRefresh);
    }

    public estimateTransferFee(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): Promise<TransferFeeEstimate> {
        return this.request(
            "estimateTransferFee",
            networkId,
            accountAddress,
            tokenId,
            transferType,
            recipientAddress,
            amount,
            feeSettings,
        );
    }

    public estimateOperationFee(
        operation: Operation,
        feeSettings: FeeSettings,
    ): Promise<TransferFeeEstimate> {
        return this.request("estimateOperationFee", operation, feeSettings);
    }
}
