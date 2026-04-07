import { ILogger, LogLevel } from "@/wallet/logger";
import { sleep } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { getErrorMessage } from "@/wallet/utils/errors";
import { jsonSanitize } from "@/wallet/utils/serialization";
import { EventsMap, EventsSpec, MethodsMap } from "../.";
import { MessageType, EventMessage, RequestMessage, ResponseMessage } from "../messages";
import { wrapParams } from "../utils";

export abstract class ServiceClient<TRequests extends MethodsMap, TEvents extends EventsMap = {}> {
    public onConnected: EventHandler<void> = new EventHandler();
    public onDisconnected: EventHandler<void> = new EventHandler();

    private readonly name: string;
    private readonly service: string;
    private readonly logger: ILogger;

    private state: ClientState = ClientState.Disconnected;
    private readonly requests: Map<number, [(result: any) => void, (error: string) => void]> = new Map();
    private nextRequestId = 1;
    private port?: chrome.runtime.Port;

    protected constructor(service: string, logger: ILogger, name?: string) {
        this.name = name ?? `${service}-client`;
        this.service = service;
        this.logger = logger;
    }

    public async connect() {
        if (this.state !== ClientState.Disconnected) {
            return;
        }
        this.state = ClientState.Connecting;
        while (this.state === ClientState.Connecting) {
            try {
                this.port = chrome.runtime.connect(undefined, { name: this.service });
                this.port.onDisconnect.addListener(this.onDisconnect);
                this.port.onMessage.addListener(this.onMessage);
                this.state = ClientState.Connected;
                this.logDebug("Connected");
                this.onConnected.invoke();
                return;
            } catch (error) {
                this.logError("Failed to connect", getErrorMessage(error));
                await sleep(1000);
            }
        }
    }

    public disconnect() {
        this.state = ClientState.Disconnecting;
        if (this.port) {
            this.port.onMessage.removeListener(this.onMessage);
            this.port.onDisconnect.removeListener(this.onDisconnect);
            this.port.disconnect();
            this.port = undefined;
        }
        if (this.requests.size) {
            this.requests.forEach(([_, reject]) => reject("Client disconnected"));
            this.requests.clear();
        }
        this.state = ClientState.Disconnected;
        this.logDebug("Disconnected");
        this.onDisconnected.invoke();
    }

    private readonly onDisconnect = () => {
        this.disconnect();
        this.connect();
    };

    private readonly onMessage = (message: ResponseMessage<TRequests> | EventMessage<TEvents>) => {
        if ((message?.type !== MessageType.Response && message.type !== MessageType.Event) || !message.content) {
            this.logWarn("Invalid message received", message);
            return;
        }
        if (message.type === MessageType.Response) {
            const { requestId, result, error } = message.content;
            const requestPromise = this.requests.get(requestId);
            if (!requestPromise) {
                this.logWarn("Invalid response received", message.content);
                return;
            }
            const [resolve, reject] = requestPromise;
            if (error !== undefined) {
                reject(error);
                this.logDebug("Request rejected", message.content);
            } else {
                resolve(result);
                this.logDebug("Request resolved", message.content);
            }
            this.requests.delete(requestId);
            this.logDebug("Pending requests", this.requests.size);
        } else {
            const { event, payload } = message.content;
            this.logDebug("Event received", event, payload);
            (this as EventsSpec<TEvents>)[event].invoke(payload);
        }
    };

    protected async request<T extends keyof TRequests>(
        method: T,
        ...params: Parameters<TRequests[T]>
    ): Promise<ReturnType<TRequests[T]>> {
        while (this.state !== ClientState.Connected) {
            if (this.state === ClientState.Disconnected) {
                this.connect();
                continue;
            }
            await sleep(300);
        }
        const request: RequestMessage<TRequests> = {
            type: MessageType.Request,
            content: {
                requestId: this.getRequestId(),
                method: method,
                params: jsonSanitize(wrapParams(params)),
            },
        };
        const promise = new Promise<ReturnType<TRequests[T]>>((resolve, reject) => {
            this.requests.set(request.content.requestId, [resolve, reject]);
        });
        this.port!.postMessage(request);

        const methodName = String(method);
        const start = Date.now();
        this.logDebug(`→ ${methodName}`);

        const warnTimer = setTimeout(() => {
            this.logWarn(`Request pending >10s: ${methodName} (id: ${request.content.requestId})`);
        }, 10_000);

        return promise.finally(() => {
            clearTimeout(warnTimer);
            this.logDebug(`← ${methodName} (${Date.now() - start}ms)`);
        });
    }

    private getRequestId() {
        return this.nextRequestId++;
    }

    protected logDebug(...data: any[]) {
        this.logger.log(this.name, LogLevel.Debug, ...data);
    }

    protected logInfo(...data: any[]) {
        this.logger.log(this.name, LogLevel.Info, ...data);
    }

    protected logWarn(...data: any[]) {
        this.logger.log(this.name, LogLevel.Warn, ...data);
    }

    protected logError(...data: any[]) {
        this.logger.log(this.name, LogLevel.Error, ...data);
    }

    public async backup(): Promise<any> {
        return this.request("backup" as keyof TRequests, ...([] as any));
    }

    public async restore(..._args: any[]): Promise<any> {
        return this.request("restore" as keyof TRequests, ...(_args as any));
    }
}

enum ClientState {
    Connecting,
    Connected,
    Disconnecting,
    Disconnected,
}
