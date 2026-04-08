import type { EventsMap, MethodsMap } from "."

export enum MessageType {
	Event = 1,
	Request = 2,
	Response = 3,
}
export type EventMessage<T extends EventsMap> = {
	type: MessageType.Event
	content: EventContent<T>
}

export type EventContent<T extends EventsMap> = {
	[E in keyof T]: {
		event: E
		payload: T[E]
	}
}[keyof T]

export type RequestMessage<T extends MethodsMap> = {
	type: MessageType.Request
	content: RequestContent<T>
}

export type RequestContent<T extends MethodsMap> = {
	[M in keyof T]: {
		requestId: number
		method: M
		params: Parameters<T[M]>
	}
}[keyof T]

export type ResponseMessage<T extends MethodsMap> = {
	type: MessageType.Response
	content: ResponseContent<T>
}

export type ResponseContent<T extends MethodsMap> = {
	[M in keyof T]: {
		requestId: number
		result?: ReturnType<T[M]>
		error?: string
	}
}[keyof T]
