import { RpcServiceClient, GenericRpcEvent } from "@/wallet/services/rpc/client";
import { sleep } from "@/wallet/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
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
    #messenger: MServer<IProxyMessage>;
    #service: RpcServiceClient;
    #connected: boolean = false;
    readonly #sessionClients: Map<string, string[]> = new Map();

    public constructor() {
        this.#messenger = new MServer(CHANNEL, this.#onInpageMessage);
        this.#service = new RpcServiceClient();
        this.#service.onConnected.add(this.#onServiceConnected);
        this.#service.onDisconnected.add(this.#onServiceDisconnected);
        this.#service.onGenericEvent.add(this.#onServiceGenericEvent);
        this.#service.connect();
    }

    readonly #onServiceConnected = () => {
        this.#connected = true;
    };

    readonly #onServiceDisconnected = () => {
        this.#connected = false;
    };

    readonly #onServiceGenericEvent = async ({ event, payload }: GenericRpcEvent) => {
        const [_session, _payload] = payload;
        if (_session) {
            const clients = this.#sessionClients.get(_session);
            if (clients) {
                for (const client of clients) {
                    try {
                        await this.#messenger.send(client, new ProxyEventMessage(event, _payload));
                    } catch {}
                }
            }
        }
    };

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
        } catch (error) {
            response = new ProxyResponseMessage(requestId, undefined, getErrorMessage(error));
        }
        await this.#messenger.send(client, response);
    };
}
