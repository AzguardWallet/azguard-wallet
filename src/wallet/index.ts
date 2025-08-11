import { BarretenbergSync } from "@aztec/bb.js"
import { type EventMessage, type IMessage, MessageType, type RequestMessage } from "./base/port-service/messages";
import type { Service } from "./base/port-service/service";
import { AccountService } from "./services/account";
import { NetworkService } from "./services/network";
import { ProfileService } from "./services/profile";
import { WalletConnectService } from "./services/wallet-connect";
import { TokenService } from "./services/token";
import { TokenBalanceService } from "./services/token-balance";
import { TransactionService } from "./services/transaction";
import { ExecutionService } from "./services/execution";
import { FaucetService } from "./services/faucet";
import { FpcService } from "./services/fpc";
import { AccountStateService } from "./services/account-state";
import { RpcService } from "./services/rpc";
import { DappSessionService } from "./services/dapp-session";
import { DappInteractionService } from "./services/dapp-interaction";
import { LoggerService } from "./services/logger";
import { LOGGER_SERVICE_NAME } from "./services/logger/client";
import { InMemoryLogs, LogLevel } from "./services/logger/client";
import { sleep } from "./utils";
import { ensureOffscreenRunning } from "./utils/offscreen";
import { jsonSanitize } from "./utils/serialization";
import { TaskService } from "./services/task";

export async function init() {
    loggerService.addLog(LogLevel.Debug, "Init BarretenbergSync...")
    await BarretenbergSync.initSingleton(process.env.BB_WASM_PATH);
    loggerService.addLog(LogLevel.Debug, "BarretenbergSync inited.")
    await ensureOffscreenRunning();
}

export function start() {
    if (isRunning) return;
    loggerService.addLog(LogLevel.Debug, "Start wallet...")
    chrome.runtime.onConnect.addListener(onConnect);
    ensureOffscreenRunning(); // ff
    isRunning = true;
    worker = runWorker();
    loggerService.addLog(LogLevel.Debug, "Wallet started.")
}

export async function stop() {
    if (!isRunning) return;
    loggerService.addLog(LogLevel.Warning, "Stop wallet...")
    isRunning = false;
    chrome.runtime.onConnect.removeListener(onConnect);
    while (ports.length) {
        loggerService.addLog(LogLevel.Debug, "Drop client...")
        ports.pop()!.disconnect();
        loggerService.addLog(LogLevel.Debug, `Client dropped. Total: ${ports.length}.`)
    }
    await worker;
    loggerService.addLog(LogLevel.Warning, "Wallet stopped.")
}

// logs
const logs = new InMemoryLogs();

// services
const loggerService = new LoggerService(logs, broadcast);
const profileService = new ProfileService(logs, broadcast);
const taskService = new TaskService(profileService, logs, broadcast);
const networkService = new NetworkService(profileService, logs, broadcast);
const accountService = new AccountService(profileService, networkService, logs, broadcast);
const tokenService = new TokenService(
    profileService,
    networkService,
    accountService,
    taskService,
    logs,
    broadcast,
);
const fpcService = new FpcService(profileService, networkService, logs, broadcast);
const transactionService = new TransactionService(
    profileService,
    accountService,
    networkService,
    logs,
    broadcast,
);
const accountStateService = new AccountStateService(networkService, logs, broadcast);
const executionService = new ExecutionService(
    profileService,
    networkService,
    accountService,
    tokenService,
    fpcService,
    transactionService,
    accountStateService,
    taskService,
    logs,
    broadcast
);
const tokenBalanceService = new TokenBalanceService(
    profileService,
    networkService,
    accountService,
    tokenService,
    transactionService,
    executionService,
    taskService,
    logs,
    broadcast,
);
const faucetService = new FaucetService(
    profileService,
    networkService,
    accountService,
    executionService,
    transactionService,
    taskService,
    logs,
    broadcast,
);
const dappSessionService = new DappSessionService(profileService, logs, broadcast);
const dappInteractionService = new DappInteractionService(
    profileService,
    networkService,
    accountService,
    dappSessionService,
    executionService,
    logs,
    broadcast,
);
const rpcService = new RpcService(
    dappSessionService,
    dappInteractionService,
    logs,
    broadcast,
);
const walletConnectService = new WalletConnectService(
    dappSessionService,
    dappInteractionService,
    logs,
    broadcast,
);

const services = new Map<string, Service>([
    [profileService.name, profileService],
    [networkService.name, networkService],
    [accountService.name, accountService],
    [tokenService.name, tokenService],
    [tokenBalanceService.name, tokenBalanceService],
    [fpcService.name, fpcService],
    [transactionService.name, transactionService],
    [executionService.name, executionService],
    [faucetService.name, faucetService],
    [dappSessionService.name, dappSessionService],
    [dappInteractionService.name, dappInteractionService],
    [rpcService.name, rpcService],
    [walletConnectService.name, walletConnectService],
    [accountStateService.name, accountStateService],
    [taskService.name, taskService],
    [loggerService.name, loggerService],
]);

// state
const ports: chrome.runtime.Port[] = [];
let worker = Promise.resolve();
let isRunning = false;

function onConnect(port: chrome.runtime.Port) {
    loggerService.addLog(LogLevel.Debug, "onConnect...");
    port.onDisconnect.addListener(onDisconnect);
    port.onMessage.addListener(onMessage);
    ports.push(port);
    loggerService.addLog(LogLevel.Debug, `Client connected. Total: ${ports.length}.`);
}

function onDisconnect(port: chrome.runtime.Port) {
    loggerService.addLog(LogLevel.Debug, "onDisconnect...");
    for (let i = ports.length - 1; i >= 0; i--) {
        if (ports[i] === port) {
            port.onDisconnect.removeListener(onDisconnect);
            port.onMessage.removeListener(onMessage);
            ports.splice(i, 1);
            loggerService.addLog(LogLevel.Debug, `Client disconnected. Total: ${ports.length}.`);
        }
    }
}

async function onMessage(message: IMessage, client: chrome.runtime.Port) {
    if (typeof message.type !== "number") return; // crutch for crx
    const isLoggerMessage = message.service === LOGGER_SERVICE_NAME; // don't log logger's messages

    if (!isLoggerMessage) loggerService.addLog(LogLevel.Debug, ["Message received", message]);
    if (message.type !== MessageType.Request) {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Error, "Invalid message");
        client.disconnect();
        return;
    }
    const request = message as RequestMessage;
    const service = services.get(request.service);
    if (!service) {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Error, ["Service is not registered", request.service]);
        client.disconnect();
        return;
    }
    const response = await service.process(request);
    if (!response) {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Error, `Service ${request.service} doesn't have method ${request.method}`);
        client.disconnect();
        return;
    }
    if (response.error === undefined) {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Debug, ["Request processed", request.requestId, response.result]);
    }
    else {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Debug, ["Request failed", request.requestId, response.error]);
    }
    send(client, response);
}

async function runWorker() {
    while (isRunning) {
        try {
            await chrome.storage.session.set({"azguard:core:liveness": Date.now()});
        }
        catch (error) {
            loggerService.addLog(LogLevel.Error, ["Wallet worker failed", error]);
        }
        await sleep(10000);
    }
}

function broadcast(event: EventMessage) {
    const isLoggerMessage = event.service === LOGGER_SERVICE_NAME;
    try {
        for (const port of ports) {
            if (port.name === event.service) {
                send(port, event);
            }
        }
        
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Debug, ["Event broadcasted.", event]);
    }
    catch (error) {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Error, ["Failed to broadcast event", error]);
    }
}

function send(port: chrome.runtime.Port, message: IMessage) {
    const isLoggerMessage = message.service === LOGGER_SERVICE_NAME;
    try {
        port.postMessage(jsonSanitize(message));

        if (!isLoggerMessage) loggerService.addLog(LogLevel.Debug, ["Message sent", message]);
    }
    catch (error) {
        if (!isLoggerMessage) loggerService.addLog(LogLevel.Error, ["Failed to send message", error]);
    }
}
