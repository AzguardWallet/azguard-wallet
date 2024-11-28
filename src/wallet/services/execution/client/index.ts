import { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import {
    ExecuteBatchRequest,
    ExecuteTransferRequest,
} from "./methods";
import { TransferType } from "../../transaction/client";
import { IAction } from "./models";

export { TransferType } from "../../transaction/client";
export * from './methods';
export * from './models';

export const EXECUTION_SERVICE_NAME = "execution";

/**
 * Client for interaction with the ExecutionService via messaging API
 */
export class ExecutionServiceClient extends ServiceClient {
    /**
     * Creates ExecutionServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
    ) {
        super(EXECUTION_SERVICE_NAME, onConnected, onDisconnected);
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
     * @throws If transaction is invalid or failed.
     */
    public executeBatch(
        network: string,
        account: string,
        actions: IAction[],
    ): Promise<string> {
        return this.request(new ExecuteBatchRequest(network, account, actions));
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
        amount: number | bigint | string,
    ): Promise<string> {
        return this.request(new ExecuteTransferRequest(
            network,
            account,
            token,
            transferType,
            recipient,
            amount,
        ));
    }
}
