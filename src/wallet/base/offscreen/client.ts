import { ILogger, LogLevel } from "@/wallet/logger"
import { getRandomHex } from "@/wallet/utils"
import { jsonSanitize } from "@/wallet/utils/serialization"
import { MessageType } from "../messages"
import { EventsMap, EventsSpec, MethodsMap } from "../."
import { EventMessage, RequestMessage, ResponseMessage } from "./messages"
import { wrapParams } from "../utils"

/** Timeout for offscreen requests (ms). PXE operations can take 60s+ (fetch timeout + proof gen). */
const REQUEST_TIMEOUT_MS = 90_000

export abstract class ServiceClient<TRequests extends MethodsMap, TEvents extends EventsMap = {}> {
	private readonly uid: string
	private readonly name: string
	private readonly service: string
	private readonly logger: ILogger

	private readonly requests: Map<number, [(result: unknown) => void, (error: string) => void]> = new Map()
	private readonly requestTimers: Map<number, NodeJS.Timeout> = new Map()
	private nextRequestId = 1
	private connected = false

	protected constructor(service: string, logger: ILogger, name?: string) {
		this.uid = getRandomHex(8)
		this.name = name ?? `${service}-client`
		this.service = service
		this.logger = logger
	}

	public connect() {
		if (this.connected) return
		chrome.runtime.onMessage.addListener(this.onMessageListener)
		this.connected = true
		this.logDebug("Connected")
	}

	public disconnect() {
		if (!this.connected) return
		this.connected = false
		chrome.runtime.onMessage.removeListener(this.onMessageListener)
		this.requestTimers.forEach((timer) => clearTimeout(timer))
		this.requestTimers.clear()
		if (this.requests.size) {
			this.requests.forEach(([_, reject]) => reject("Client disconnected"))
			this.requests.clear()
		}
		this.logDebug("Disconnected")
	}

	private readonly onMessageListener = (message: ResponseMessage<TRequests> | EventMessage<TEvents>): boolean => {
		if (message.to === this.uid || (message.type === MessageType.Event && message.from === this.service && message.to === undefined)) {
			this.onMessage(message) // fire and forget
		}
		return false
	}

	private readonly onMessage = (message: ResponseMessage<TRequests> | EventMessage<TEvents>) => {
		if (
			(message?.type !== MessageType.Response && message.type !== MessageType.Event) ||
			message.from !== this.service ||
			!message.content
		) {
			this.logWarn("Invalid message received", message)
			return
		}
		if (message.type === MessageType.Response) {
			const { requestId, result, error } = message.content
			const requestPromise = this.requests.get(requestId)
			if (!requestPromise) {
				this.logWarn("Invalid response received", message.content)
				return
			}
			const [resolve, reject] = requestPromise
			if (error !== undefined) {
				reject(error)
				this.logDebug("Request rejected", message.content)
			} else {
				resolve(result)
				this.logDebug("Request resolved", message.content)
			}
			this.requests.delete(requestId)
			const timer = this.requestTimers.get(requestId)
			if (timer) {
				clearTimeout(timer)
				this.requestTimers.delete(requestId)
			}
			this.logDebug("Pending requests", this.requests.size)
		} else {
			const { event, payload } = message.content
			this.logDebug("Event received", event, payload)
			;(this as EventsSpec<TEvents>)[event].invoke(payload)
		}
	}

	protected async request<T extends keyof TRequests>(method: T, ...params: Parameters<TRequests[T]>): Promise<ReturnType<TRequests[T]>> {
		if (!this.connected) {
			this.connect()
		}
		const request: RequestMessage<TRequests> = {
			type: MessageType.Request,
			content: {
				requestId: this.getRequestId(),
				method: method,
				params: jsonSanitize(wrapParams(params)) as Parameters<TRequests[T]>,
			},
			from: this.uid,
			to: this.service,
		}
		const requestId = request.content.requestId
		const promise = new Promise<ReturnType<TRequests[T]>>((resolve, reject) => {
			this.requests.set(requestId, [resolve as (result: unknown) => void, reject])
			const timer = setTimeout(() => {
				if (this.requests.delete(requestId)) {
					this.requestTimers.delete(requestId)
					const methodName = String(method)
					this.logError(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${methodName}`)
					reject(`Offscreen request timed out: ${methodName}`)
				}
			}, REQUEST_TIMEOUT_MS)
			this.requestTimers.set(requestId, timer)
		})
		await chrome.runtime.sendMessage(request)
		this.logDebug("Request sent", request)
		this.logDebug("Pending requests", this.requests.size)
		return promise
	}

	private getRequestId() {
		return this.nextRequestId++
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
}
