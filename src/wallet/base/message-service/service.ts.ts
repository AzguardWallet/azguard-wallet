import { jsonSanitize } from "@/wallet/utils/serialization";
import {
    type ILogsAsync,
    LogLevel,
    LogOrigin
} from "@/wallet/services/logger/client/models";
import {
    EventContent,
    EventMessage,
    type IMessage,
    MessageType,
    type RequestMessage,
    ResponseContent,
    ResponseMessage,
} from "./messages";

export abstract class Service<TMethod, TEvent> {
    private readonly logger: ILogsAsync;

    protected constructor(
        public readonly name: string,
        logger: ILogsAsync,
    ) {
        this.logger = logger;
    }

    protected log(level: LogLevel, args: any, message?: string) {
        this.logger.addLog(
            level,
            args,
            message,
            this.name,
            LogOrigin.BG,
        );
    }

    protected logDebug(args: any, message?: string) {
        this.log(LogLevel.Debug, args, message);
    }

    protected logInfo(args: any, message?: string) {
        this.log(LogLevel.Info, args, message);
    }

    protected logWarn(args: any, message?: string) {
        this.log(LogLevel.Warning, args, message);
    }

    protected logError(args: any, message?: string) {
        this.log(LogLevel.Error, args, message);
    }
    
    public start() {
        chrome.runtime.onMessage.addListener(this.onMessageListener);
        this.logDebug(`Service started ${this.name}`);
    }

    public stop() {
        chrome.runtime.onMessage.removeListener(this.onMessageListener);
        this.logDebug(`Service stopped ${this.name}`);
    }

    private readonly onMessageListener = (message: IMessage<unknown>): boolean => {
        if (message.to === this.name) {
            this.onMessage(message); // fire and forget
        }
        return false;
    }

    private readonly onMessage = async (message: IMessage<unknown>) => {
        this.logDebug(["Message received", message]);
        if (message.type !== MessageType.Request || 
            message.from === undefined ||
            message.content === undefined
        ) {
            this.logWarn("Invalid message");
            return;
        }
        const { content: request } = message as RequestMessage<TMethod, unknown>;
        this.logDebug(["Request received", request]);
        if (!request.requestId || !request.method) {
            this.logWarn("Invalid request");
            return;
        }
        let responseContent: ResponseContent<unknown>;
        try {
            const result = await this.onRequest(request.method, request.params);
            this.logDebug(["Request processed", request.requestId, result]);
            responseContent = new ResponseContent(
                request.requestId,
                jsonSanitize(result),
                undefined,
            );
        }
        catch (error: unknown) {
            this.logDebug(["Request failed", request.requestId, error]);
            responseContent = new ResponseContent(
                request.requestId,
                undefined,
                `${(error as Error)?.message ?? error ?? "Unknown error"}`,
            );
        }
        this.logDebug(["Request created", responseContent]);
        const responseMessage = new ResponseMessage(
            responseContent,
            this.name,
            message.from,
        );
        chrome.runtime.sendMessage(responseMessage);
        this.logDebug(["Message sent", responseMessage]);
    };

    protected emit(event: TEvent, payload?: unknown, to?: string) {
        const eventContent = new EventContent(
            event,
            jsonSanitize(payload),
        );
        this.logDebug(["Event created", eventContent]);
        const eventMessage = new EventMessage(
            eventContent,
            this.name,
            to,
        );
        chrome.runtime.sendMessage(eventMessage);
        this.logDebug(["Message sent", eventMessage]);
    }

    protected abstract onRequest(method: TMethod, params: unknown): Promise<unknown>;
}
