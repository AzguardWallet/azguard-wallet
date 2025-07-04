import { jsonSanitize } from "@/wallet/utils/serialization";
import {
    type ILogsAsync,
    type LogEntity,
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

    public start() {
        chrome.runtime.onMessage.addListener(this.onMessageListener);
        this.log(LogLevel.Debug, `Service started ${this.name}`);
    }

    public stop() {
        chrome.runtime.onMessage.removeListener(this.onMessageListener);
        this.log(LogLevel.Debug, `Service stopped ${this.name}`);
    }

    private readonly onMessageListener = (message: IMessage<unknown>): boolean => {
        if (message.to === this.name) {
            this.onMessage(message); // fire and forget
        }
        return false;
    }

    private readonly onMessage = async (message: IMessage<unknown>) => {
        this.log(LogLevel.Debug, ["Message received", message]);
        if (message.type !== MessageType.Request || 
            message.from === undefined ||
            message.content === undefined
        ) {
            this.log(LogLevel.Warning, "Invalid message");
            return;
        }
        const { content: request } = message as RequestMessage<TMethod, unknown>;
        this.log(LogLevel.Debug, ["Request received", request]);
        if (!request.requestId || !request.method) {
            this.log(LogLevel.Warning, "Invalid request");
            return;
        }
        let responseContent: ResponseContent<unknown>;
        try {
            const result = await this.onRequest(request.method, request.params);
            this.log(LogLevel.Debug, ["Request processed", request.requestId, result]);
            responseContent = new ResponseContent(
                request.requestId,
                jsonSanitize(result),
                undefined,
            );
        }
        catch (error: unknown) {
            this.log(LogLevel.Debug, ["Request failed", request.requestId, error]);
            responseContent = new ResponseContent(
                request.requestId,
                undefined,
                `${(error as Error)?.message ?? error ?? "Unknown error"}`,
            );
        }
        this.log(LogLevel.Debug, ["Request created", responseContent]);
        const responseMessage = new ResponseMessage(
            responseContent,
            this.name,
            message.from,
        );
        chrome.runtime.sendMessage(responseMessage);
        this.log(LogLevel.Debug, ["Message sent", responseMessage]);
    };

    protected emit(event: TEvent, payload?: unknown, to?: string) {
        const eventContent = new EventContent(
            event,
            jsonSanitize(payload),
        );
        this.log(LogLevel.Debug, ["Event created", eventContent]);
        const eventMessage = new EventMessage(
            eventContent,
            this.name,
            to,
        );
        chrome.runtime.sendMessage(eventMessage);
        this.log(LogLevel.Debug, ["Message sent", eventMessage]);
    }

    protected abstract onRequest(method: TMethod, params: unknown): Promise<unknown>;
}
