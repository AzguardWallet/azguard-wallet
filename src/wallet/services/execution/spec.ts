import type { TransferType, Tx, LocalTxOrigin } from "@/wallet/services/transaction/spec";
import type { FeeSettings, TransferFeeEstimate, Operation, OperationResult } from "./models";

export const EXECUTION_SERVICE_NAME = "execution";

export * from "./models";

export type Methods = {
    /**
     * Executes batch request and returns transaction hash.
     * @param network Network id.
     * @param account Sender account address.
     * @param token Token id.
     * @param transferType Transfer type.
     * @param recipient Recipient address.
     * @param amount Amount.
     */
    executeTransfer(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): string;

    /**
     * Executes batch of operations.
     * @param operations Operations to execute.
     * @param origin Origin.
     */
    executeOperations(operations: Operation[], origin: LocalTxOrigin): OperationResult[];

    /**
     * Cancel pending transaction.
     * @param cancellingTx Transaction to cancel.
     * @param networkId Network id.
     */
    cancelTx(cancellingTx: Tx, networkId: string, feeSettings: FeeSettings): string;

    /**
     * Estimates the fee for a transfer without executing it.
     * Runs simulation in the background and returns fee breakdown.
     */
    estimateTransferFee(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): TransferFeeEstimate;

    /**
     * Estimates the fee for a pre-built operation (send_transaction or aztec_sendTx).
     */
    estimateOperationFee(
        operation: Operation,
        feeSettings: FeeSettings,
    ): TransferFeeEstimate;
};
