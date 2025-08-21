import { sleep } from "@/wallet/utils";
import { jsonSanitize } from "@/wallet/utils/serialization";
import { type IMessage, MessageType, type EventMessage, type RequestMessage, type ResponseMessage } from "./messages";
import { type ILogsAsync, LogLevel, LogOrigin } from "@/wallet/services/logger/client/models";

export abstract class ServiceClient {
    private readonly serviceName: string;
    private readonly logger: ILogsAsync;
    private readonly onConnected?: () => void;
    private readonly onDisconnected?: () => void;
    private readonly requests: Map<number, [(result: any) => void, (error: string) => void]>;
    private port?: chrome.runtime.Port;
    private connection: Promise<void>;
    private disposed = false;

    protected constructor(
        serviceName: string,
        logger: ILogsAsync,
        onConnected?: () => void,
        onDisconnected?: () => void
    ) {
        this.serviceName = serviceName;
        this.logger = logger;
        this.onConnected = onConnected;
        this.onDisconnected = onDisconnected;
        this.requests = new Map();
        this.port = undefined;
        this.connection = this.connect();
    }

    protected log(level: LogLevel, ...args: any[]) {
        return this.logger.addLog(
            level,
            args,
            this.serviceName,
            LogOrigin.BG,
        );
    }

    protected logDebug(...args: any[]) {
        return this.log(LogLevel.Debug, ...args);
    }

    protected logInfo(...args: any[]) {
        return this.log(LogLevel.Info, ...args);
    }

    protected logWarn(...args: any[]) {
        return this.log(LogLevel.Warning, ...args);
    }

    protected logError(...args: any[]) {
        return this.log(LogLevel.Error, ...args);
    }

    protected abstract onEvent(message: EventMessage): void;

    protected async request<T>(request: RequestMessage): Promise<T> {
        while (!this.port && !this.disposed) {
            await this.connection;
        }
        if (this.disposed) {
            throw new Error("Cannot send requests from disposed client");
        }
        this.logDebug("Request created", request);
        // just in case
        if (this.requests.has(request.requestId)) {
            throw new Error(`Request with id ${request.requestId} already exists`);
        }
        const promise = new Promise<T>((resolve, reject) => {
            this.requests.set(request.requestId, [resolve, reject]);
        });
        this.logDebug("Pending requests", this.requests.size);
        const requestMessage = jsonSanitize(request);
        this.port!.postMessage(requestMessage);
        this.logDebug("Message sent", requestMessage);
        return promise;
    }
    
    private async connect() {
        while (!this.disposed) {
            try {
                this.logDebug("Connecting...");
                this.port = chrome.runtime.connect(undefined, { name: this.serviceName });
                this.port.onDisconnect.addListener(this.onDisconnect);
                this.port.onMessage.addListener(this.onMessage);
                this.logDebug("Connected.");
                if (this.onConnected) {
                    try { this.onConnected(); } catch {}
                }
                return;
            }
            catch (error) {
                this.logError("Failed to connect.", error)
                await sleep(1000);
            }
        }
    }
    
    private readonly onDisconnect = () => {
        this.logDebug("Disconnecting...");
        this.port?.onMessage.removeListener(this.onMessage);
        this.port?.onDisconnect.removeListener(this.onDisconnect);
        this.port = undefined;
        this.requests.forEach(([_, reject]) => reject("Client disconnected"));
        this.requests.clear();
        this.logDebug("Disconnected.");
        if (this.onDisconnected) {
            try { this.onDisconnected(); } catch {}
        }
        this.connection = this.connect();
    }

    private readonly onMessage = (message: IMessage) => {
        this.logDebug("Message received", message);
        if (message.type !== MessageType.Response && message.type !== MessageType.Event) {
            this.logWarn("Invalid message");
            return;
        }
        if (message.type === MessageType.Response) {
            const response = message as ResponseMessage;
            const requestPromise = this.requests.get(response.requestId);
            if (!requestPromise) {
                this.logWarn("Invalid response");
                return;
            }
            const [resolve, reject] = requestPromise;
            if (response.error !== undefined) {
                reject(response.error);
                this.logDebug("Request rejected", response.requestId, response.error);
            }
            else {
                resolve(response.result);
                this.logDebug("Request resolved", response.requestId, response.result);
            }
            this.requests.delete(response.requestId);
            this.logDebug("Pending requests", this.requests.size);
        }
        else {
            const event = message as EventMessage;
            try { this.onEvent(event); } catch {}
            this.logDebug("Event processed", event);
        }
    }

    public dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.port?.onMessage.removeListener(this.onMessage);
        this.port?.onDisconnect.removeListener(this.onDisconnect);
        this.port?.disconnect();
        this.requests.forEach(([_, reject]) => reject("Client disposed"));
        this.requests.clear();
    }
}
