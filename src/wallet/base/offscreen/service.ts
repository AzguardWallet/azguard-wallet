import { ILogger, LogLevel } from "@/wallet/logger";
import { sleep } from "@walletconnect/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { jsonSanitize } from "@/wallet/utils/serialization";
import { EventsMap, MethodsMap, MethodsSpec, IService, EventsSpec, ServiceCollection } from "../.";
import { MessageType } from "../messages";
import { unwrapParams } from "../utils";
import { EventMessage, RequestMessage, ResponseMessage } from "./messages";

export abstract class Service<TRequests extends MethodsMap, TEvents extends EventsMap = {}> implements IService {
    public readonly name: string;
    private readonly logger: ILogger;
    private get events() {
        return this as unknown as EventsSpec<TEvents>;
    }
    private get requests() {
        return this as unknown as MethodsSpec<TRequests>;
    }
    private initialized = false;

    protected constructor(name: string, logger: ILogger) {
        this.name = name;
        this.logger = logger;
        chrome.runtime.onMessage.addListener(this.onMessageListener);
        this.logDebug("Service created");
    }

    protected async init(services: ServiceCollection): Promise<void> {
        // to be overridden in derived classes
    }

    public async start(services: ServiceCollection) {
        if (this.initialized) return;
        await this.init(services);
        this.initialized = true;
        this.logDebug("Service started");
    }

    private readonly onMessageListener = (message: RequestMessage<TRequests>): boolean => {
        if (message.to === this.name) {
            this.onMessage(message); // fire and forget
        }
        return false;
    };

    private readonly onMessage = async (message: RequestMessage<TRequests>) => {
        if (message?.type !== MessageType.Request || !message.from || !message.content) {
            this.logWarn("Invalid message received", message);
            return;
        }
        const { requestId, method, params: wrappedParams } = message.content;
        if (!requestId || !(method in this.requests) || typeof wrappedParams !== "object") {
            this.logWarn("Invalid request received", message);
            return;
        }
        const params = unwrapParams(wrappedParams);
        this.logDebug("Request received", requestId, method, params);
        let response: ResponseMessage<TRequests>;
        try {
            const result = await this.requests[method](...params);
            this.logDebug("Request processed", requestId, result);
            response = {
                type: MessageType.Response,
                content: {
                    requestId,
                    result: jsonSanitize(result),
                },
                from: this.name,
                to: message.from,
            };
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logDebug("Request failed", requestId, errorMessage);
            response = {
                type: MessageType.Response,
                content: {
                    requestId,
                    error: errorMessage,
                },
                from: this.name,
                to: message.from,
            };
        }
        chrome.runtime.sendMessage(response);
        this.logDebug("Response sent", response);
    };

    protected emit<T extends keyof TEvents>(event: T, payload: TEvents[T]) {
        const message: EventMessage<TEvents> = {
            type: MessageType.Event,
            content: {
                event,
                payload: jsonSanitize(payload),
            },
            from: this.name,
        };
        chrome.runtime.sendMessage(message);
        this.events[event].invoke(payload);
        this.logDebug("Event sent", message);
    }

    protected async ensureInitialized() {
        if (this.initialized) {
            return;
        }
        let restMs = 30_000;
        while (!this.initialized && restMs > 0) {
            await sleep(500);
            restMs -= 500;
        }
        if (!this.initialized) {
            throw new Error("Service not initialized");
        }
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
}
