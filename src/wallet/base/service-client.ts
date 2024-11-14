import { sleep } from "../utils";
import { IMessage, MessageType, EventMessage, RequestMessage, ResponseMessage } from "./messages";

export abstract class ServiceClient {
    private readonly serviceName: string;
    private readonly onConnected?: () => void;
    private readonly onDisconnected?: () => void;
    private readonly requests: Map<number, [(result: any) => void, (error: string) => void]>;
    private port?: chrome.runtime.Port;
    private connection: Promise<void>;
    
    protected constructor(serviceName: string, onConnected?: () => void, onDisconnected?: () => void) {
        this.serviceName = serviceName;
        this.onConnected = onConnected;
        this.onDisconnected = onDisconnected;
        this.requests = new Map();
        this.port = undefined;
        this.connection = this.connect();
    }

    protected abstract onEvent(message: EventMessage): void;

    protected async request<T>(request: RequestMessage): Promise<T> {
        while (!this.port) {
            await this.connection;
        }
        if (this.requests.has(request.id)) {
            // this case is highly unlikely
            throw new Error(`request with id ${request.id} already exists`);
        }
        const promise = new Promise<T>((resolve, reject) => {
            this.requests.set(request.id, [resolve, reject]);
        });
        console.debug(`Request #${request.id} created. Total: ${this.requests.size}.`);
        this.port.postMessage(request);
        console.debug(`Request #${request.id} sent.`);
        return promise;
    }
    
    private async connect() {
        while (true) {
            try {
                console.debug("Connecting...");
                this.port = chrome.runtime.connect(undefined, { name: this.serviceName });
                this.port.onDisconnect.addListener(this.onDisconnect);
                this.port.onMessage.addListener(this.onMessage);
                console.debug("Connected.");
                if (this.onConnected) {
                    try {this.onConnected();} catch {}
                }
                return;
            }
            catch (error) {
                console.error("Failed to connect.", error);
                await sleep(1000);
            }
        }
    }
    
    private readonly onDisconnect = () => {
        console.debug("onDisconnect...");
        this.port?.onMessage.removeListener(this.onMessage);
        this.port?.onDisconnect.removeListener(this.onDisconnect);
        this.port = undefined;
        this.requests.forEach(([_, reject]) => reject('disconnected'));
        this.requests.clear();
        console.error("Disconnected.");
        if (this.onDisconnected) {
            try {this.onDisconnected();} catch {}
        }
        this.connection = this.connect();
    }

    private readonly onMessage = (message: IMessage) => {
        console.debug("Message received.", message);
        switch (message.type) {
            case MessageType.Event:
                try {this.onEvent(message as EventMessage);} catch {}
                break;
            case MessageType.Response:
                const response = message as ResponseMessage;
                const requestPromise = this.requests.get(response.requestId);
                if (requestPromise) {
                    console.debug(`Response for request #${response.requestId} received.`);
                    const [resolve, reject] = requestPromise;
                    if (response.error) reject(response.error);
                    else resolve(response.result);
                    this.requests.delete(response.requestId);
                    console.debug(`Request #${response.requestId} processed. Total: ${this.requests.size}.`);
                }
                else {
                    console.error(`Unexpected request id ${response.requestId}.`);
                }
                break;
            default:
                console.error(`Unexpected message type ${message.type}.`);
                break;
        }
    }
}