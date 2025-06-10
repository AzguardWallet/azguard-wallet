import { RpcServiceClient } from "@/wallet/services/rpc/client";
import { sleep } from "@/wallet/utils";
import { MServer } from "./messenger/server";
import {
    ProxyMessageType,
    IProxyMessage,
    ProxyRequestMessage,
    ProxyResponseMessage,
    ProxyEventMessage,
} from "./messages";
import { CHANNEL } from "./utils";

export class ProxyServer {
    #connected: boolean = false;
    #service: RpcServiceClient = null!;
    #messenger: MServer<IProxyMessage> = null!;
    readonly #sessionClients: Map<string, string[]> = new Map();
    
    public constructor() {
        this.#service = new RpcServiceClient(
            this.#onServiceConnected,
            this.#onServiceDisconnected,
            this.#onServiceGenericEvent,
        );
        this.#messenger = new MServer<IProxyMessage>(
            CHANNEL,
            this.#onInpageMessage,
        );
    }

    readonly #onServiceConnected = () => {
        this.#connected = true;
    }

    readonly #onServiceDisconnected = () => {
        this.#connected = false;
    }

    readonly #onServiceGenericEvent = async (event: string, payload: [string, any]) => {
        const [_session, _payload] = payload;
        if (_session) {
            const clients = this.#sessionClients.get(_session);
            if (clients) {
                for (const client of clients) {
                    try {
                        await this.#messenger.send(client, new ProxyEventMessage(event, _payload));
                    }
                    catch {}
                }
            }
        }
    }
    
    readonly #onInpageMessage = async (client: string, message: IProxyMessage) => {
        if (message.type != ProxyMessageType.Request) {
            return;
        }
        while (!this.#connected) {
            await sleep(300);
        }
        const { requestId, method, payload } = message as ProxyRequestMessage;
        let response;
        try {
            const result = await this.#service.invoke(method, payload);
            const [_session, _result] = result;
            if (_session) {
                let clients = this.#sessionClients.get(_session);
                if (!clients) {
                    clients = [];
                    this.#sessionClients.set(_session, clients);
                }
                clients.push(client);
            }
            response = new ProxyResponseMessage(requestId, _result);
        }
        catch (error) {
            response = new ProxyResponseMessage(requestId, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
        }
        await this.#messenger.send(client, response);
    }
}