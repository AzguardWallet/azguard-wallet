import { EventMessage as BaseEventMessage, RequestMessage as BaseRequestMessage, ResponseMessage as BaseResponseMessage } from "../messages"
import { EventsMap, MethodsMap } from "../."

type MessageExt = {
	from: string
	to?: string
}

export type EventMessage<T extends EventsMap> = BaseEventMessage<T> & MessageExt
export type RequestMessage<T extends MethodsMap> = BaseRequestMessage<T> & MessageExt
export type ResponseMessage<T extends MethodsMap> = BaseResponseMessage<T> & MessageExt
