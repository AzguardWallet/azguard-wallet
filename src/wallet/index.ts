import { BarretenbergSync } from "@aztec/bb.js"
import { EventMessage, IMessage, MessageType, RequestMessage } from "./base/messages";
import { Service } from "./base/service";
import { AccountService } from "./services/account";
import { NetworkService } from "./services/network";
import { ProfileService } from "./services/profile";
import { WalletConnectService } from "./services/wallet-connect";
import { PxeService } from "./services/pxe";
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
import { sleep } from "./utils";
import { jsonSanitize } from "./utils/serialization";

export async function init() {
    console.debug("Init BarretenbergSync...");
    await BarretenbergSync.initSingleton(process.env.BB_WASM_PATH);
    console.debug("BarretenbergSync inited.");
}

export function start() {
    if (isRunning) return;
    console.debug("Start wallet...");
    chrome.runtime.onConnect.addListener(onConnect);
    isRunning = true;
    worker = runWorker();
    console.debug("Wallet started.");
}

export async function stop() {
    if (!isRunning) return;
    console.warn("Stop wallet...");
    isRunning = false;
    chrome.runtime.onConnect.removeListener(onConnect);
    while (ports.length) {
        console.debug("Drop client...");
        ports.pop()!.disconnect();
        console.debug(`Client dropped. Total: ${ports.length}.`);
    }
    await worker;
    console.warn("Wallet stopped.");
}

// services
const profileService = new ProfileService(broadcast);
const networkService = new NetworkService(profileService, broadcast);
const pxeService = new PxeService(profileService, networkService, broadcast);
const accountService = new AccountService(profileService, networkService, broadcast);
const tokenService = new TokenService(profileService, networkService, pxeService,accountService, broadcast);
const fpcService = new FpcService(profileService, networkService, pxeService,broadcast);
const transactionService = new TransactionService(
    profileService,
    accountService,
    networkService,
    broadcast,
);
const accountStateService = new AccountStateService(networkService, pxeService, broadcast);
const executionService = new ExecutionService(
    profileService,
    networkService,
    pxeService,
    accountService,
    tokenService,
    fpcService,
    transactionService,
    accountStateService,
    broadcast
);
const tokenBalanceService = new TokenBalanceService(
    profileService,
    networkService,
    accountService,
    tokenService,
    transactionService,
    executionService,
    broadcast,
);
const faucetService = new FaucetService(
    profileService,
    networkService,
    pxeService,
    accountService,
    executionService,
    transactionService,
    tokenService,
    broadcast,
);
const dappSessionService = new DappSessionService(profileService, broadcast);
const dappInteractionService = new DappInteractionService(dappSessionService, broadcast);
const rpcService = new RpcService(
    dappSessionService,
    dappInteractionService,
    broadcast,
);
const walletConnectService = new WalletConnectService(
    dappSessionService,
    dappInteractionService,
    broadcast,
);

const services = new Map<string, Service>([
    [profileService.name, profileService],
    [networkService.name, networkService],
    [pxeService.name, pxeService],
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
]);

// state
const ports: chrome.runtime.Port[] = [];
let worker = Promise.resolve();
let isRunning = false;

function onConnect(port: chrome.runtime.Port) {
    console.debug("onConnect...");
    port.onDisconnect.addListener(onDisconnect);
    port.onMessage.addListener(onMessage);
    ports.push(port);
    console.debug(`Client connected. Total: ${ports.length}.`);
}

function onDisconnect(port: chrome.runtime.Port) {
    console.debug("onDisconnect...");
    for (let i = ports.length - 1; i >= 0; i--) {
        if (ports[i] === port) {
            port.onDisconnect.removeListener(onDisconnect);
            port.onMessage.removeListener(onMessage);
            ports.splice(i, 1);
            console.debug(`Client disconnected. Total: ${ports.length}.`);
        }
    }
}

async function onMessage(message: IMessage, client: chrome.runtime.Port) {
    if (typeof message.type !== 'number') return; // crutch for crx
    console.debug("onMessage...");
    if (message.type !== MessageType.Request) {
        console.error(`Message type ${message.type} is not allowed. Drop client.`);
        client.disconnect();
        return;
    }
    const request = message as RequestMessage;
    const service = services.get(request.service);
    if (!service) {
        console.error(`Service ${request.service} is not registered. Drop client.`);
        client.disconnect();
        return;
    }
    console.debug(`Request ${request.service}:${request.id} received.`);
    const response = await service.process(request);
    if (!response) {
        console.error(`Service ${request.service} doesn't have method ${request.method}. Drop client.`);
        client.disconnect();
        return;
    }
    console.debug(`Request ${request.service}:${request.id} processed. Send response...`);
    send(client, response);
}

async function runWorker() {
    while (isRunning) {
        try {
            await chrome.storage.session.set({"azguard:core:liveness": Date.now()});
        }
        catch (error) {
            console.error("Wallet worker failed", error);
        }
        await sleep(10000);
    }
}

function broadcast(event: EventMessage) {
    try {
        for (const port of ports) {
            if (port.name === event.service) {
                send(port, event);
            }
        }
        console.debug("Event broadcasted.", event);
    }
    catch (error) {
        console.error("Failed to broadcast event.", error);
    }
}

function send(port: chrome.runtime.Port, message: IMessage) {
    try {
        port.postMessage(jsonSanitize(message));
        console.debug("Message sent.", message);
    }
    catch (error) {
        console.error("Failed to send message.", error);
    }
}
