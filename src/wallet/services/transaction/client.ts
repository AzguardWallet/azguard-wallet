import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type Events, type Methods, TRANSACTION_SERVICE_NAME, type Tx, type TxIndexerCursor } from "./spec"

export * from "./spec"

export class TransactionServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onTransactionAdded = new EventHandler<Tx>()
	public readonly onTransactionUpdated = new EventHandler<Tx>()
	public readonly onTransactionDeleted = new EventHandler<Tx>()

	public constructor(name?: string) {
		super(TRANSACTION_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getTransactions(account: string): Promise<Tx[]> {
		return this.request("getTransactions", account)
	}

	public getTransaction(hash: string): Promise<Tx> {
		return this.request("getTransaction", hash)
	}

	public syncTransactionHistory(chainId: number, address: string): Promise<void> {
		return this.request("syncTransactionHistory", chainId, address)
	}

	public getTxSyncCursor(address: string): Promise<TxIndexerCursor | null> {
		return this.request("getTxSyncCursor", address)
	}
}
