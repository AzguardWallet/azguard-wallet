import { sleep } from "@/wallet/utils";
import { jsonSanitize } from "@/wallet/utils/serialization";
import { type IMessage, MessageType, type EventMessage, type RequestMessage, type ResponseMessage } from "./messages";
import { type ILogsAsync, type LogEntity, LogLevel } from "@/wallet/services/logger/client/models";

export abstract class ServiceClient {
    private readonly serviceName: string;
    private readonly logger: ILogsAsync;
    private readonly onConnected?: () => void;
    private readonly onDisconnected?: () => void;
    private readonly requests: Map<number, [(result: any) => void, (error: string) => void]>;
    private port?: chrome.runtime.Port;
    private connection: Promise<void>;
    private disposed: boolean = false;

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

    protected log(level: LogLevel, args: any, message?: string) {
        const rawArgs = Array.isArray(args) ? args : [args];
        const stringArgs = rawArgs.map(a => {
            if (!a) return String(a)
            
            if (typeof a === "object") {
                try {
                    return JSON.stringify(a);
                } catch {
                    return String(a)
                }
            }

            return String(a)
        })

        const newLogEntity: LogEntity = {
            level,
            ts: Date.now(),
            args: stringArgs,
            message,
            source: `background-${this.serviceName}`,
        };

        this.logger.addLog(newLogEntity);
    }

    protected abstract onEvent(message: EventMessage): void;

    protected async request<T>(request: RequestMessage): Promise<T> {
        while (!this.port && !this.disposed) {
            await this.connection;
        }
        if (this.disposed) {
            throw new Error("Cannot send requests from disposed client");
        }
        // console.debug("Request created", request);
        this.log(LogLevel.Debug, ["Request created", request]);
        // just in case
        if (this.requests.has(request.requestId)) {
            throw new Error(`Request with id ${request.requestId} already exists`);
        }
        const promise = new Promise<T>((resolve, reject) => {
            this.requests.set(request.requestId, [resolve, reject]);
        });
        // console.debug("Pending requests", this.requests.size);
        this.log(LogLevel.Debug, ["Pending requests", this.requests.size]);
        const requestMessage = jsonSanitize(request);
        this.port!.postMessage(requestMessage);
        // console.debug("Message sent", requestMessage);
        this.log(LogLevel.Debug, ["Message sent", requestMessage]);
        return promise;
    }
    
    private async connect() {
        while (!this.disposed) {
            try {
                // console.debug("Connecting...");
                this.log(LogLevel.Debug, "Connecting...");
                this.port = chrome.runtime.connect(undefined, { name: this.serviceName });
                this.port.onDisconnect.addListener(this.onDisconnect);
                this.port.onMessage.addListener(this.onMessage);
                // console.debug("Connected.");
                this.log(LogLevel.Debug, "Connected.");
                if (this.onConnected) {
                    try { this.onConnected(); } catch {}
                }
                return;
            }
            catch (error) {
                // console.error("Failed to connect.", error);
                this.log(LogLevel.Debug, ["Failed to connect.", error]);
                await sleep(1000);
            }
        }
    }
    
    private readonly onDisconnect = () => {
        // console.debug("Disconnecting...");
        this.log(LogLevel.Debug, "Disconnecting...");
        this.port?.onMessage.removeListener(this.onMessage);
        this.port?.onDisconnect.removeListener(this.onDisconnect);
        this.port = undefined;
        this.requests.forEach(([_, reject]) => reject("Client disconnected"));
        this.requests.clear();
        // console.debug("Disconnected.");
        this.log(LogLevel.Debug, "Disconnected.");
        if (this.onDisconnected) {
            try { this.onDisconnected(); } catch {}
        }
        this.connection = this.connect();
    }

    private readonly onMessage = (message: IMessage) => {
        // console.debug("Message received", message);
        this.log(LogLevel.Debug, ["Message received", message]);
        if (message.type !== MessageType.Response && message.type !== MessageType.Event) {
            // console.warn("Invalid message");
            this.log(LogLevel.Warning, "Invalid message");
            return;
        }
        if (message.type === MessageType.Response) {
            const response = message as ResponseMessage;
            const requestPromise = this.requests.get(response.requestId);
            if (!requestPromise) {
                // console.warn("Invalid response");
                this.log(LogLevel.Warning, "Invalid response");
                return;
            }
            const [resolve, reject] = requestPromise;
            if (response.error !== undefined) {
                reject(response.error);
                // console.debug("Request rejected", response.requestId, response.error);
                this.log(LogLevel.Debug, ["Request rejected", response.requestId, response.error]);
            }
            else {
                resolve(response.result);
                // console.debug("Request resolved", response.requestId, response.result);
                this.log(LogLevel.Debug, ["Request resolved", response.requestId, response.result]);
            }
            this.requests.delete(response.requestId);
            // console.debug("Pending requests", this.requests.size);
            this.log(LogLevel.Debug, ["Pending requests", this.requests.size]);
        }
        else {
            const event = message as EventMessage;
            try { this.onEvent(event); } catch {}
            // console.debug("Event processed", event);
            this.log(LogLevel.Debug, ["Event processed", event]);
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