import { type ILogger, LogLevel } from "@/wallet/logger"
import { sleep } from "@/wallet/utils"
import { getErrorMessage } from "@/wallet/utils/errors"
import { jsonSanitize } from "@/wallet/utils/serialization"
import type { EventsMap, MethodsMap, MethodsSpec, IService, EventsSpec, ServiceCollection } from "../."
import { MessageType, type EventMessage, type RequestMessage, type ResponseMessage } from "../messages"
import { unwrapParams } from "../utils"

export abstract class Service<TRequests extends MethodsMap, TEvents extends EventsMap = {}> implements IService {
	public readonly name: string
	protected readonly logger: ILogger
	private readonly clients: chrome.runtime.Port[] = []
	private get events() {
		return this as unknown as EventsSpec<TEvents>
	}
	private get requests() {
		return this as unknown as MethodsSpec<TRequests>
	}
	private initialized = false

	protected constructor(name: string, logger: ILogger) {
		this.name = name
		this.logger = logger
		chrome.runtime.onConnect.addListener(this.onConnect)
		this.logDebug("Service created")
	}

	protected async init(_services: ServiceCollection): Promise<void> {
		// to be overridden in derived classes
	}

	public async start(services: ServiceCollection) {
		if (this.initialized) return
		await this.init(services)
		this.initialized = true
		this.logDebug("Service started")
	}

	private readonly onConnect = (client: chrome.runtime.Port) => {
		if (client.name !== this.name) {
			return
		}
		client.onDisconnect.addListener(this.onDisconnect)
		client.onMessage.addListener(this.onMessage)
		this.clients.push(client)
		this.logDebug(`Client connected. Total: ${this.clients.length}`)
	}

	private readonly onDisconnect = (client: chrome.runtime.Port) => {
		client.onDisconnect.removeListener(this.onDisconnect)
		client.onMessage.removeListener(this.onMessage)
		const index = this.clients.indexOf(client)
		if (index === -1) {
			this.logWarn("Unknown client disconnected")
			return
		}
		this.clients.splice(index, 1)
		this.logDebug(`Client disconnected. Total: ${this.clients.length}`)
	}

	private readonly onMessage = async (message: RequestMessage<TRequests>, client: chrome.runtime.Port) => {
		if (message?.type !== MessageType.Request || !message.content) {
			this.logWarn("Invalid message received", message)
			return
		}
		const { requestId, method, params: wrappedParams } = message.content
		if (!requestId || !(method in this.requests) || typeof wrappedParams !== "object") {
			this.logWarn("Invalid request received", message)
			return
		}
		const params = unwrapParams(wrappedParams)
		this.logDebug("Request received", requestId, method, params)
		let response: ResponseMessage<TRequests>
		try {
			const result = await this.requests[method](...params)
			this.logDebug("Request processed", requestId, result)
			response = {
				type: MessageType.Response,
				content: {
					requestId,
					result: jsonSanitize(result),
				},
			}
		} catch (error) {
			const errorMessage = getErrorMessage(error)
			this.logDebug("Request failed", requestId, errorMessage)
			response = {
				type: MessageType.Response,
				content: {
					requestId,
					error: errorMessage,
				},
			}
		}
		this.send(response, client)
		this.logDebug("Response sent", response)
	}

	protected emit<T extends keyof TEvents>(event: T, payload: TEvents[T]) {
		const message: EventMessage<TEvents> = {
			type: MessageType.Event,
			content: {
				event,
				payload: jsonSanitize(payload),
			},
		}
		for (const client of this.clients) {
			this.send(message, client)
		}
		this.events[event].invoke(payload)
		this.logDebug("Event sent", message)
	}

	private send(message: unknown, client: chrome.runtime.Port) {
		try {
			client.postMessage(message)
		} catch (error) {
			if (this.clients.includes(client)) {
				this.logError("Failed to send message", getErrorMessage(error))
			}
		}
	}

	protected async ensureInitialized() {
		if (this.initialized) {
			return
		}
		let restMs = 30_000
		while (!this.initialized && restMs > 0) {
			await sleep(500)
			restMs -= 500
		}
		if (!this.initialized) {
			throw new Error("Service not initialized")
		}
	}

	protected logDebug(...data: unknown[]) {
		this.logger.log(this.name, LogLevel.Debug, ...data)
	}

	protected logInfo(...data: unknown[]) {
		this.logger.log(this.name, LogLevel.Info, ...data)
	}

	protected logWarn(...data: unknown[]) {
		this.logger.log(this.name, LogLevel.Warn, ...data)
	}

	protected logError(...data: unknown[]) {
		this.logger.log(this.name, LogLevel.Error, ...data)
	}

	public async backup(): Promise<unknown> {
		// can be overridden in derived classes if necessary
		return null
	}

	public async restore(..._args: unknown[]): Promise<unknown> {
		// can be overridden in derived classes if necessary
		return null
	}
}
