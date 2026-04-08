import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { EventHandler } from "@/wallet/utils/event-handler"
import { ACCOUNT_STATE_SERVICE_NAME, type Events, type Methods } from "./spec"
import { LoggerServiceClient } from "../logger/client"

export * from "./spec"

export class AccountStateServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onSenderAdded = new EventHandler<string>()
	public readonly onSenderDeleted = new EventHandler<string>()

	public constructor(name?: string) {
		super(ACCOUNT_STATE_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getAccounts(networkId: string): Promise<string[]> {
		return this.request("getAccounts", networkId)
	}

	public getSenders(networkId: string): Promise<string[]> {
		return this.request("getSenders", networkId)
	}

	public addSender(networkId: string, address: string): Promise<string> {
		return this.request("addSender", networkId, address)
	}

	public deleteSender(networkId: string, address: string): Promise<string> {
		return this.request("deleteSender", networkId, address)
	}

	public getContracts(networkId: string): Promise<string[]> {
		return this.request("getContracts", networkId)
	}
}
