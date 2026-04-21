import type { ServiceSpec } from "@/wallet/base"
import { Service } from "@/wallet/base/background"
import type { ILogger } from "@/wallet/logger"
import { PASSKEY_SERVICE_NAME, type Methods, type PasskeyCredentialData, type PasskeyRequest, type PasskeyRequestPromise } from "./spec"
import { PasskeyCredential } from "./credential"
import { getRandomHex } from "@/wallet/utils"

export * from "./spec"

/**
 * Hard timeout for a passkey popup. Bounds the worst case when neither the
 * user interacts nor `chrome.windows.onRemoved` fires (eg. extension reload,
 * popup crash, MV3 suspension races). 5 minutes is ample for WebAuthn UX.
 */
const PASSKEY_TIMEOUT_MS = 5 * 60 * 1000

export class PasskeyService extends Service<Methods> implements ServiceSpec<Methods> {
	public static name = PASSKEY_SERVICE_NAME

	private pending: Map<string, PasskeyRequestPromise> = new Map()

	public constructor(logger: ILogger) {
		super(PASSKEY_SERVICE_NAME, logger)
	}

	public async createKey(userHandle: string): Promise<PasskeyCredential> {
		return await this.openWindowAndWait({ mode: "create", userHandle })
	}

	public async getKey(credentialId?: string): Promise<PasskeyCredential> {
		return await this.openWindowAndWait({ mode: "get", credentialId })
	}

	public async getPendingRequest(requestId: string): Promise<PasskeyRequest> {
		const entry = this.pending.get(requestId)
		if (!entry) throw new Error("Invalid request id")
		return entry.request
	}

	public async resolvePasskeyRequest(requestId: string, result: PasskeyCredentialData): Promise<void> {
		const entry = this.pending.get(requestId)
		if (!entry) throw new Error("Invalid request id")
		const credential = await PasskeyCredential.create(result)
		this.pending.delete(requestId)
		this.logDebug("Passkey request resolved: ", credential.id)
		entry.resolve(credential)
	}

	public async rejectPasskeyRequest(requestId: string, reason: string): Promise<void> {
		const entry = this.pending.get(requestId)
		if (!entry) throw new Error("Invalid request id")
		this.pending.delete(requestId)
		this.logInfo("Passkey request rejected: ", reason)
		entry.reject(reason)
	}

	private async openWindowAndWait(request: PasskeyRequest): Promise<PasskeyCredential> {
		let id: string
		do {
			id = getRandomHex(8)
		} while (this.pending.has(id))
		const promise = new Promise<PasskeyCredential>((resolve, reject) => {
			this.pending.set(id, { resolve, reject, request })
		})

		const fail = (reason: string) => {
			const entry = this.pending.get(id)
			if (entry) {
				this.pending.delete(id)
				entry.reject(reason)
			}
		}

		const timeoutHandle = setTimeout(() => fail("Passkey request timed out"), PASSKEY_TIMEOUT_MS)

		chrome.windows.create(
			{
				type: "popup",
				url: chrome.runtime.getURL(`src/popup/index.html#/windows/passkey?requestId=${id}`),
				height: 800,
				width: 500,
			},
			(createdWindow) => {
				// chrome.runtime.lastError must be read inside the callback to clear it.
				const runtimeError = chrome.runtime.lastError
				if (runtimeError || !createdWindow || createdWindow.id == null) {
					clearTimeout(timeoutHandle)
					fail(runtimeError?.message ?? "Failed to open passkey window")
					return
				}

				const windowId = createdWindow.id

				const onRemoved = (closedWindowId: number) => {
					if (closedWindowId === windowId) {
						chrome.windows.onRemoved.removeListener(onRemoved)
						clearTimeout(timeoutHandle)
						fail("User closed the passkey window")
					}
				}

				chrome.windows.onRemoved.addListener(onRemoved)
			},
		)

		return promise.finally(() => clearTimeout(timeoutHandle))
	}
}
