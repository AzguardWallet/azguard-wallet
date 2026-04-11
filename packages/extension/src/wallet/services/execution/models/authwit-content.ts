import type { CallAction, EncodedCallAction } from "./action"

export type AuthwitContent = CallAuthwitContent | EncodedCallAuthwitContent | IntentAuthwitContent | MessageHashAuthwitContent

export type CallAuthwitContent = Omit<CallAction, "kind"> & {
	readonly kind: "call"
	readonly caller: string
}

export type EncodedCallAuthwitContent = Omit<EncodedCallAction, "kind"> & {
	readonly kind: "encoded_call"
	readonly caller: string
}

export type IntentAuthwitContent = {
	readonly kind: "intent"
	readonly consumer: string
	readonly intent: string[]
}

export type MessageHashAuthwitContent = {
	readonly kind: "message_hash"
	readonly messageHash: string
}
