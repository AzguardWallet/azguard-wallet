import { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { PASSKEY_SERVICE_NAME, Methods, PasskeyRequest, PasskeyCredentialData } from "./spec"

export * from "./spec"

export class PasskeyServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
	public constructor(name?: string) {
		super(PASSKEY_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getPendingRequest(requestId: string): Promise<PasskeyRequest> {
		return this.request("getPendingRequest", requestId)
	}

	public resolvePasskeyRequest(requestId: string, result: PasskeyCredentialData): Promise<void> {
		return this.request("resolvePasskeyRequest", requestId, result)
	}

	public rejectPasskeyRequest(requestId: string, reason: string): Promise<void> {
		return this.request("rejectPasskeyRequest", requestId, reason)
	}
}
