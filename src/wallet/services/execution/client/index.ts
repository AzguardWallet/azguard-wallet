import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import type { TransferType, TxOrigin } from "@/wallet/services/transaction/client";
import { ExecuteOperationsRequest, ExecuteTransferRequest } from "./methods";
import type { FeeSettings, IOperation, IOperationResult } from "./models";

export { TransferType } from "../../transaction/client";
export * from './methods';
export * from './models';

export const EXECUTION_SERVICE_NAME = "execution";

/**
 * Client for interaction with the ExecutionService via messaging API
 */
export class ExecutionServiceClient extends ServiceClient {
    /**
     * Creates ExecutionServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
    ) {
        super(EXECUTION_SERVICE_NAME, new LoggerServiceClient, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Executes batch request and returns transaction hash.
     * @param network Network id.
     * @param account Sender account address.
     * @param token Token id.
     * @param transferType Transfer type.
     * @param recipient Recipient address.
     * @param amount Amount.
     * @throws If transaction is invalid or failed.
     */
    public executeTransfer(
        network: string,
        account: string,
        token: number,
        transferType: TransferType,
        recipient: string,
        amount: number | bigint,
        feeSettings: FeeSettings,
    ): Promise<string> {
        return this.request(new ExecuteTransferRequest(
            network,
            account,
            token,
            transferType,
            recipient,
            amount,
            feeSettings,
        ));
    }

    public executeOperations(operations: IOperation[], origin: TxOrigin): Promise<IOperationResult[]> {
        return this.request(new ExecuteOperationsRequest(operations, origin));
    }
}
