import { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { Methods, Note, NOTE_SERVICE_NAME } from "./spec"

export * from "./spec"

export class NoteServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
	public constructor(name?: string) {
		super(NOTE_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getNotes(networkId: string, account: string, contract?: string): Promise<Note[]> {
		return this.request("getNotes", networkId, account, contract)
	}
}
