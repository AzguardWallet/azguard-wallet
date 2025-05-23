import { getRandomHex } from "@/wallet/utils";
import { jsonSanitize } from "@/wallet/utils/serialization";
import {
    IMessage,
    MessageType,
    EventMessage,
    RequestMessage,
    ResponseMessage,
    RequestContent,

} from "./messages";

export abstract class ServiceClient<TMethod, TEvent> {
    private readonly name: string;
    private readonly service: string;
    private readonly requests: Map<number, [(result: any) => void, (error: string) => void]>;
    private disposed: boolean = false;
    
    protected constructor(service: string, name?: string) {
        this.name = name ?? getRandomHex(8);
        this.service = service;
        this.requests = new Map();

        chrome.runtime.onMessage.addListener(this.onMessageListener);
    }

    public dispose() {
        if (this.disposed) return;
        this.disposed = true;
        chrome.runtime.onMessage.removeListener(this.onMessageListener);
        this.requests.forEach(([_, reject]) => reject("Client disposed"));
        this.requests.clear();
    }

    private readonly onMessageListener = (message: IMessage<unknown>): boolean => {
        if (message.to === this.name || message.type === MessageType.Event && message.from === this.service && message.to === undefined) {
            this.onMessage(message); // fire and forget
        }
        return false;
    }

    private readonly onMessage = async (message: IMessage<unknown>) => {
        // console.debug("Message received", message);
        if (message.type !== MessageType.Response && message.type !== MessageType.Event || 
            message.from !== this.service ||
            message.content === undefined
        ) {
            // console.warn("Invalid message");
            return;
        }
        if (message.type === MessageType.Response) {
            const { content: response } = message as ResponseMessage<unknown>;
            // console.debug("Response received", response);
            const requestPromise = this.requests.get(response.requestId);
            if (!requestPromise) {
                // console.warn("Invalid response");
                return;
            }
            const [resolve, reject] = requestPromise;
            if (response.error !== undefined) {
                reject(response.error);
                // console.debug("Request rejected", response.requestId, response.error);
            }
            else {
                resolve(response.result);
                // console.debug("Request resolved", response.requestId, response.result);
            }
            this.requests.delete(response.requestId);
            // console.debug("Pending requests", this.requests.size);
        }
        else {
            const { content: event } = message as EventMessage<TEvent, unknown>;
            // console.debug("Event received", event);
            try { this.onEvent(event.event, event.payload); } catch {}
        }
    };

    protected async request<T>(method: TMethod, params?: unknown): Promise<T> {
        if (this.disposed) {
            throw new Error("Cannot send requests from disposed client");
        }
        const requestContent = new RequestContent(
            method,
            jsonSanitize(params),
        );
        // console.debug("Request created", requestContent.requestId, requestContent);
        // just in case
        if (this.requests.has(requestContent.requestId)) {
            throw new Error(`Request with id ${requestContent.requestId} already exists`);
        }
        const promise = new Promise<T>((resolve, reject) => {
            this.requests.set(requestContent.requestId, [resolve, reject]);
        });
        // console.debug("Pending requests", this.requests.size);
        const requestMessage = new RequestMessage(
            requestContent,
            this.name,
            this.service,
        );
        await chrome.runtime.sendMessage(requestMessage);
        // console.debug("Message sent", requestMessage);
        return promise;
    }

    protected abstract onEvent(event: TEvent, payload: unknown): void;
}