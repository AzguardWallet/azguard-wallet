import { BarretenbergSync } from "@aztec/bb.js"
import { EventMessage, IMessage, MessageType, RequestMessage } from "./base/messages";
import { Service } from "./base/service";
import { AccountService } from "./services/account";
import { NetworkService } from "./services/network";
import { ProfileService } from "./services/profile";
import { InteractionService } from "./services/interaction";
import { WalletConnectService } from "./services/wallet-connect";
import { TokenService } from "./services/token";
import { sleep } from "./utils";
import { TokenBalanceService } from "./services/token-balance";
import { TransactionService } from "./services/transaction";
import { ExecutionService } from "./services/execution";
import { FaucetService } from "./services/faucet";
import { PxeService } from "./services/pxe";

export async function init() {
    console.debug("Init BarretenbergSync...");
    await BarretenbergSync.initSingleton();
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
const accountService = new AccountService(profileService, networkService, broadcast);
const tokenService = new TokenService(profileService, networkService, accountService, broadcast);
const tokenBalanceService = new TokenBalanceService(
    profileService,
    networkService,
    accountService,
    tokenService,
    broadcast,
);
const transactionService = new TransactionService(
    profileService,
    accountService,
    networkService,
    tokenBalanceService,
    broadcast,
);
const pxeService = new PxeService(networkService, broadcast);
const executionService = new ExecutionService(
    profileService,
    networkService,
    accountService,
    tokenService,
    transactionService,
    pxeService,
    broadcast
);
const faucetService = new FaucetService(
    profileService,
    networkService,
    accountService,
    executionService,
    tokenService,
    broadcast,
);
const interactionService = new InteractionService(executionService, broadcast);
const walletConnectService = new WalletConnectService(interactionService, broadcast);

const services = new Map<string, Service>([
    [profileService.name, profileService],
    [networkService.name, networkService],
    [accountService.name, accountService],
    [tokenService.name, tokenService],
    [tokenBalanceService.name, tokenBalanceService],
    [transactionService.name, transactionService],
    [executionService.name, executionService],
    [faucetService.name, faucetService],
    [interactionService.name, interactionService],
    [walletConnectService.name, walletConnectService],
    [pxeService.name, pxeService],
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
            console.debug("I'm working...");
        }
        catch (error) {
            console.error("Wallet worker crashed", error);
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
        port.postMessage(message);
        console.debug("Message sent.", message);
    }
    catch (error) {
        console.error("Failed to send message.", error);
    }
}
