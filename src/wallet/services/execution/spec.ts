import type { TransferType, LocalTxOrigin } from "@/wallet/services/transaction/spec";
import type { FeeSettings, Operation, OperationResult } from "./models";

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
};
