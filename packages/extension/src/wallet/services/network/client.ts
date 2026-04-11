import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type Events, type Methods, type Network, NETWORK_SERVICE_NAME, type NodeStatus } from "./spec"

export * from "./spec"

export class NetworkServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onNetworkAdded = new EventHandler<Network>()
	public readonly onNetworkUpdated = new EventHandler<Network>()
	public readonly onNetworkDeleted = new EventHandler<Network>()
	public readonly onDefaultNetworkChanged = new EventHandler<Network>()

	public constructor(name?: string) {
		super(NETWORK_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getOrInitNetworks(): Promise<Network[]> {
		return this.request("getOrInitNetworks")
	}

	public getNetworks(chainId?: number): Promise<Network[]> {
		return this.request("getNetworks", chainId)
	}

	public getNetwork(id: string): Promise<Network> {
		return this.request("getNetwork", id)
	}

	public addNetwork(name: string, rpcUrl: string): Promise<Network> {
		return this.request("addNetwork", name, rpcUrl)
	}

	public updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
		return this.request("updateNetwork", id, name, rpcUrl)
	}

	public deleteNetwork(id: string): Promise<Network> {
		return this.request("deleteNetwork", id)
	}

	public setDefault(id: string): Promise<Network> {
		return this.request("setDefault", id)
	}

	public getNodeStatus(id: string): Promise<NodeStatus> {
		return this.request("getNodeStatus", id)
	}
}
