import "@/utils/console-sniffer";
import { BarretenbergSync } from "@aztec/bb.js";
import { ServiceCollection } from "./base";
import { ConfigStore } from "./config";
import { consoleMethods, LoggerStore, LogLevel } from "./logger";
import { AccountService } from "./services/account/service";
import { AccountStateService } from "./services/account-state/service";
import { AuthRegistryService } from "./services/auth-registry/service";
import { ConfigService } from "./services/config/service";
import { ContactService } from "./services/contact/service";
import { DappInteractionService } from "./services/dapp-interaction/service";
import { DappSessionService } from "./services/dapp-session/service";
import { ExecutionService } from "./services/execution/service";
import { FpcService } from "./services/fpc/service";
import { LogViewerService } from "./services/log-viewer/service";
import { LoggerService } from "./services/logger/service";
import { NetworkService } from "./services/network/service";
import { NoteService } from "./services/note/service";
import { ProfileService } from "./services/profile/service";
import { TaskService } from "./services/task/service";
import { TokenService } from "./services/token/service";
import { TokenBalanceService } from "./services/token-balance/service";
import { TransactionService } from "./services/transaction/service";
import { PasskeyService } from "./services/passkey/service";
import { initWalletSdkHandler } from "./services/wallet-sdk/background";
import { sleep } from "./utils";
import { getErrorData, getErrorMessage } from "./utils/errors";

const config = new ConfigStore();
const logger = new LoggerStore(config);
const services = new ServiceCollection();
logger.log("wallet", LogLevel.Info, "Service worker started");

const initRuntime = () => {
    // catch console
    for (const [method, level] of consoleMethods) {
        (self as any)[`on${method}`] = (...args: any[]) => {
            logger.log("wallet", level, ...args);
        };
    }
    // catch unhandled errors
    self.onunhandledrejection = (e: PromiseRejectionEvent) => {
        logger.log("wallet", LogLevel.Error, getErrorData(e.reason));
    };
    // chrome.runtime.onInstalled.addListener(async opt => {
    //     if (opt.reason === "install") {
    //         chrome.tabs.create({
    //             active: true,
    //             url: chrome.runtime.getURL("src/setup/index.html?type=install"),
    //         });
    //     }
    //     if (opt.reason === "update") {
    //         chrome.tabs.create({
    //             active: true,
    //             url: chrome.runtime.getURL("src/setup/index.html?type=update"),
    //         });
    //     }
    // });
    chrome.runtime.setUninstallURL("https://azguardwallet.io/forms/uninstall");
    logger.log("wallet", LogLevel.Info, "Runtime configured");
};

const initConfig = async () => {
    await config.load();
    logger.log("wallet", LogLevel.Info, "Config loaded");
};

const initBarretenberg = async () => {
    await BarretenbergSync.initSingleton({ wasmPath: process.env.BB_WASM_PATH });
    logger.log("wallet", LogLevel.Info, "Barretenberg initialized");
};

const runServices = async () => {
    await Promise.all([initConfig(), initBarretenberg()]);

    services.add(new AccountService(logger));
    services.add(new AccountStateService(logger));
    services.add(new AuthRegistryService(logger));
    services.add(new ConfigService(config, logger));
    services.add(new ContactService(logger));
    services.add(new DappInteractionService(logger));
    services.add(new DappSessionService(logger));
    services.add(new ExecutionService(logger));
    services.add(new FpcService(logger));
    services.add(new LogViewerService(logger));
    services.add(new LoggerService(logger));
    services.add(new NetworkService(logger));
    services.add(new NoteService(logger));
    services.add(new ProfileService(config, logger));
    services.add(new TaskService(logger));
    services.add(new TokenService(logger));
    services.add(new TokenBalanceService(logger));
    services.add(new TransactionService(logger));
    services.add(new PasskeyService(logger));

    await services.start();
    logger.log("wallet", LogLevel.Info, "Services started");

    // Initialize wallet-sdk protocol handler (discovery, key exchange, encrypted channel)
    initWalletSdkHandler(services, logger);
};

const runHeartbit = async () => {
    while (true) {
        try {
            await chrome.storage.session.set({ "azguard:liveness": Date.now() });
        } catch (error) {
            logger.log("wallet", LogLevel.Error, "Heartbit failed", getErrorMessage(error));
        }
        await sleep(10_000);
    }
};

initRuntime();
runServices();
runHeartbit();

export {};
