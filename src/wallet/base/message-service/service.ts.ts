import { jsonSanitize } from "@/wallet/utils/serialization";
import {
    EventContent,
    EventMessage,
    IMessage,
    MessageType,
    RequestMessage,
    ResponseContent,
    ResponseMessage,
} from "./messages";

export abstract class Service<TMethod, TEvent> {
    protected constructor(public readonly name: string) {}

    public start() {
        chrome.runtime.onMessage.addListener(this.onMessageListener);
        console.debug("Service started", this.name);
    }

    public stop() {
        chrome.runtime.onMessage.removeListener(this.onMessageListener);
        console.debug("Service stopped", this.name);
    }

    private readonly onMessageListener = (message: IMessage<unknown>): boolean => {
        if (message.to === this.name) {
            this.onMessage(message); // fire and forget
        }
        return false;
    }

    private readonly onMessage = async (message: IMessage<unknown>) => {
        console.debug("Message received", message);
        if (message.type !== MessageType.Request || 
            message.from === undefined ||
            message.content === undefined
        ) {
            console.warn("Invalid message");
            return;
        }
        const { content: request } = message as RequestMessage<TMethod, unknown>;
        console.debug("Request received", request);
        if (!request.requestId || !request.method) {
            console.warn("Invalid request");
            return;
        }
        let responseContent: ResponseContent<unknown>;
        try {
            const result = await this.onRequest(request.method, request.params);
            console.debug("Request processed", request.requestId, result);
            responseContent = new ResponseContent(
                request.requestId,
                jsonSanitize(result),
                undefined,
            );
        }
        catch (error: unknown) {
            console.debug("Request failed", request.requestId, error);
            responseContent = new ResponseContent(
                request.requestId,
                undefined,
                `${(error as Error)?.message ?? error ?? "Unknown error"}`,
            );
        }
        console.debug("Response created", responseContent);
        const responseMessage = new ResponseMessage(
            responseContent,
            this.name,
            message.from,
        );
        chrome.runtime.sendMessage(responseMessage);
        console.debug("Message sent", responseMessage);
    };

    protected emit(event: TEvent, payload?: unknown, to?: string) {
        const eventContent = new EventContent(
            event,
            jsonSanitize(payload),
        );
        console.debug("Event created", eventContent);
        const eventMessage = new EventMessage(
            eventContent,
            this.name,
            to,
        );
        chrome.runtime.sendMessage(eventMessage);
        console.debug("Message sent", eventMessage);
    }

    protected abstract onRequest(method: TMethod, params: unknown): Promise<unknown>;
}
