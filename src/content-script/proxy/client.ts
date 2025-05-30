import { Lock } from "@/wallet/utils";
import { MClient } from "./messenger/client ";
import {
    ProxyMessageType,
    IProxyMessage,
    ProxyRequestMessage,
    ProxyResponseMessage,
    ProxyEventMessage,
} from "./messages";
import { CHANNEL } from "./utils";

export class ProxyClient {
    #messenger: MClient<IProxyMessage> = null!;
    readonly #requests: Map<number, [(result: any) => void, (error: string) => void]> = new Map();
    readonly #eventHandlers: Map<string, ((payload: any) => void)[]> = new Map();
    readonly #lock: Lock = new Lock();

    public constructor() {
        this.#messenger = new MClient<IProxyMessage>(CHANNEL, this.#onMessage);
    }
    
    public on(event: string, handler: (payload: any) => void) {
        let handlers = this.#eventHandlers.get(event);
        if (!handlers) {
            handlers = [];
            this.#eventHandlers.set(event, handlers);
        }
        handlers.push(handler);
    }

    public off(event: string, handler: (payload: any) => void) {
        const handlers = this.#eventHandlers.get(event);
        if (!handlers) {
            return;
        }
        const index = handlers.findIndex(x => x === handler);
        if (index === -1) {
            return;
        }
        handlers.splice(index, 1);
        if (handlers.length === 0) {
            this.#eventHandlers.delete(event);
        }
    }

    public async request(method: string, payload: any): Promise<any> {
        try {
            await this.#lock.enter();
            
            let requestId;
            do {requestId = Math.random()}
            while(this.#requests.has(requestId));

            const promise = new Promise<any>((resolve, reject) => {
                this.#requests.set(requestId, [resolve, reject]);
            });

            await this.#messenger?.send(new ProxyRequestMessage(requestId, method, payload));

            return promise;
        }
        finally {
            this.#lock.leave();
        }
    }

    readonly #onMessage = (message: IProxyMessage) => {
        switch (message.type) {
            case ProxyMessageType.Event: {
                const { event, payload } = message as ProxyEventMessage;
                const handlers = this.#eventHandlers.get(event);
                if (handlers) {
                    for (const handler of handlers) {
                        try {handler(payload)} catch {}
                    }
                }
                break;
            }
            case ProxyMessageType.Response: {
                const response = message as ProxyResponseMessage;
                const requestPromise = this.#requests.get(response.requestId);
                if (requestPromise) {
                    const [resolve, reject] = requestPromise;
                    if (response.error === undefined) {
                        resolve(response.result);
                    }
                    else {
                        reject(response.error);
                    }
                    this.#requests.delete(response.requestId);
                }
                else {
                    console.error(`Invalid request id ${response.requestId}.`);
                }
                break;
            }
            default: {
                console.error(`Invalid message type ${message.type}.`);
                break;
            }
        }
    }
}