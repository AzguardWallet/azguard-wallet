import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Events, Methods, TRANSACTION_SERVICE_NAME, Tx } from "./spec";

export * from "./spec";

export class TransactionServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onTransactionAdded = new EventHandler<Tx>();
    public readonly onTransactionUpdated = new EventHandler<Tx>();
    public readonly onTransactionDeleted = new EventHandler<Tx>();

    public constructor(name?: string) {
        super(TRANSACTION_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getTransactions(account: string): Promise<Tx[]> {
        return this.request("getTransactions", account);
    }

    public getTransaction(hash: string): Promise<Tx> {
        return this.request("getTransaction", hash);
    }
}
