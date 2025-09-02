import { WalletKit, type WalletKitTypes } from "@reown/walletkit";
import { Core } from "@walletconnect/core";
import type { ProposalTypes, SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { DappSessionService, DappMetadata, DappPermissions, DappSession } from "@/wallet/services/dapp-session/service";
import {
    DappInteractionService,
    ConnectionParams,
    DappSessionInfo,
    ExecutionParams,
} from "@/wallet/services/dapp-interaction/service";
import { AzguardWalletInfo, RpcMethod } from "@/wallet/services/rpc/types";
import { parseExecutionParams, parseConnectionParams } from "@/wallet/services/rpc/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { sleep } from "@/wallet/utils/sleep";
import { Methods, WALLET_CONNECT_SERVICE_NAME } from "./spec";

export * from "./spec";

export class WalletConnectService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = WALLET_CONNECT_SERVICE_NAME;

    private walletKit?: InstanceType<typeof WalletKit>;

    private dappSessions: DappSessionService = null!;
    private dappInteractions: DappInteractionService = null!;

    public constructor(logger: ILogger) {
        super(WALLET_CONNECT_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.dappSessions = services.get(DappSessionService.name);
        this.dappInteractions = services.get(DappInteractionService.name);

        while (true) {
            try {
                const WALLET_CONNECT_PROJECT_ID = "d809b7373c4209e576c9033266578783";
                const WALLET_CONNECT_METADATA = {
                    name: AzguardWalletInfo.name,
                    description: AzguardWalletInfo.description,
                    url: AzguardWalletInfo.url,
                    icons: [AzguardWalletInfo.logo],
                };
                const WALLET_CONNECT_LOG_LEVEL = "silent"; // silent | error | warn | info | debug | trace

                const core = new Core({
                    projectId: WALLET_CONNECT_PROJECT_ID,
                    logger: WALLET_CONNECT_LOG_LEVEL,
                });
                this.configureLoggers(core, WALLET_CONNECT_LOG_LEVEL);

                this.walletKit = await WalletKit.init({
                    core,
                    metadata: WALLET_CONNECT_METADATA,
                });
                this.walletKit.on("session_proposal", this.onSessionProposal);
                this.walletKit.on("proposal_expire", this.onProposalExpire);
                this.walletKit.on("session_request", this.onSessionRequest);
                this.walletKit.on("session_request_expire", this.onSessionRequestExpire);
                this.walletKit.on("session_delete", this.onSessionDelete);
                this.walletKit.on("session_authenticate", this.onSessionAuthenticate);

                this.dappSessions.onDappSessionUpdated.add(this.onDappSessionUpdated);
                this.dappSessions.onDappSessionDeleted.add(this.onDappSessionDeleted);

                for (const topic of Object.keys(this.walletKit.getActiveSessions())) {
                    if (!(await this.dappSessions.tryGetDappSession(topic))) {
                        this.disconnectSession(topic);
                    }
                }

                this.logDebug("Wallet connect service initialized");
                break;
            } catch (error) {
                this.logError("Failed to initialize wallet connect service. Retry...", getErrorMessage(error));
                await sleep(1000);
            }
        }
    }

    private configureLoggers = (core: InstanceType<typeof Core>, level: string) => {
        const noop = () => {};
        const loggerConfig = {
            error: level !== "silent" ? this.logError : noop,
            warn: ["warn", "info", "debug", "trace"].includes(level) ? this.logWarn : noop,
            info: ["info", "debug", "trace"].includes(level) ? this.logInfo : noop,
            debug: ["debug", "trace"].includes(level) ? this.logDebug : noop,
            trace: level === "trace" ? this.logDebug : noop,
        };
        const paths = [
            "logger",
            "history.logger",
            "relayer.logger",
            "relayer.messages.logger",
            "relayer.publisher.logger",
            "relayer.subscriber.logger",
            "expirer.logger",
            "pairing.logger",
            "pairing.pairings.logger",
        ];

        paths.forEach(path => {
            const keys = path.split(".");
            const target = keys.reduce((obj, key) => obj[key], core as any);
            Object.assign(target, loggerConfig);
        });
    };

    public async connectByURI(uri: string) {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }
        await this.walletKit.pair({ uri });
    }

    private readonly onSessionProposal = async (payload: WalletKitTypes.SessionProposal) => {
        this.logDebug("WC: session proposal received", payload);

        // approve proposal
        let dappSession: DappSessionInfo;
        try {
            const dappMetadata: DappMetadata = {
                name: payload.params.proposer.metadata.name,
                description: payload.params.proposer.metadata.description,
                logo: payload.params.proposer.metadata.icons[0],
                url: payload.params.proposer.metadata.url,
            };
            const requiredPermissions: DappPermissions[] = Object.entries(payload.params.requiredNamespaces).map(
                ([k, v]) => ({ ...v, chains: v.chains?.length ? v.chains : [k] }),
            );
            const optionalPermissions: DappPermissions[] = Object.entries(payload.params.optionalNamespaces).map(
                ([k, v]) => ({ ...v, chains: v.chains?.length ? v.chains : [k] }),
            );
            const params: ConnectionParams = parseConnectionParams({
                dappMetadata,
                requiredPermissions,
                optionalPermissions,
            });
            dappSession = await this.dappInteractions.connect(params, payload.params.id.toString());
        } catch (error) {
            this.logDebug("WC: session proposal rejected", getErrorMessage(error));
            this.rejectSession(payload.id);
            return;
        }
        // instantiate wc session
        let wcSession: SessionTypes.Struct;
        try {
            wcSession = await this.walletKit!.approveSession({
                id: payload.id,
                namespaces: this.buildSessionNamespaces(
                    payload.params.requiredNamespaces,
                    payload.params.optionalNamespaces,
                    dappSession.permissions,
                    dappSession.accounts,
                ),
            });
        } catch (error) {
            this.logDebug("WC: session approval failed", getErrorMessage(error));
            this.dappSessions.deleteDappSession(dappSession.id);
            this.rejectSession(payload.id);
            return;
        }
        // upgrade dapp session
        try {
            await this.dappSessions.upgradeDappSession(dappSession.id, wcSession.topic, wcSession.expiry * 1000);
        } catch (error) {
            this.logDebug("WC: session upgrade failed", getErrorMessage(error));
            this.dappSessions.deleteDappSession(dappSession.id);
            this.disconnectSession(wcSession.topic);
            return;
        }
    };

    private readonly onProposalExpire = async (payload: WalletKitTypes.ProposalExpire) => {
        this.logDebug("WC: proposal expire received", payload);
        this.dappInteractions.cancelInteraction(payload.id.toString());
    };

    private readonly onSessionRequest = async (payload: WalletKitTypes.SessionRequest) => {
        this.logDebug("WC: session request received", payload);
        try {
            switch (payload.params.request.method) {
                case RpcMethod.get_wallet_info: {
                    await this.respondRequest(payload, AzguardWalletInfo);
                    break;
                }
                case RpcMethod.get_session: {
                    throw new Error("Use WallecConnect's 'getSession()' method instead");
                }
                case RpcMethod.close_session: {
                    throw new Error("Use WallecConnect's 'disconnect()' method instead");
                }
                case RpcMethod.connect: {
                    throw new Error("Use WallecConnect's 'connect()' method instead");
                }
                case RpcMethod.execute: {
                    const params: ExecutionParams = parseExecutionParams({
                        ...payload.params.request.params,
                        sessionId: payload.topic,
                    });
                    const results = await this.dappInteractions.execute(params, payload.id.toString());
                    await this.respondRequest(payload, results);
                    break;
                }
                default: {
                    throw new Error(
                        `'${payload.params.request.method}' cannot be invoked directly, but as a part of a batch`,
                    );
                }
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logDebug("WC: session request failed", errorMessage);
            this.rejectRequest(payload, errorMessage);
        }
    };

    private readonly onSessionRequestExpire = async (payload: WalletKitTypes.SessionRequestExpire) => {
        this.logDebug("WC: session request expire received", payload);
        this.dappInteractions.cancelInteraction(payload.id.toString());
    };

    private readonly onSessionDelete = async (payload: WalletKitTypes.SessionDelete) => {
        this.logDebug("WC: session delete received", payload);
        this.dappSessions.deleteDappSession(payload.topic);
    };

    private readonly onSessionAuthenticate = async (payload: WalletKitTypes.SessionAuthenticate) => {
        this.logDebug("Session authenticate received", payload);

        // const accounts = await this.accounts.getAccounts("9181ab0c", 31337)
        // const account = accounts[0]

        // const namespaces = buildApprovedNamespaces({
        //     proposal: payload?.params,
        //     supportedNamespaces: {
        //         aztec: {
        //             chains: "aztec:31337",
        //             methods: ["personal_sign"],
        //             events: ["accountsChanged", "chainChanged"],
        //             accounts: accounts.map(acc => acc.address),
        //         },
        //     },
        // });

        // // return [await this._addNetwork("Sandbox", "https://rpc.sandbox.azguardwallet.io", 31337)];

        // await this.walletKit.approveSession({
        //     id: payload.id,
        //     namespaces,
        // });

        // const supportedChains = ["aztec:31337"]
        // const supportedMethods = ["personal_sign", "eth_sendTransaction", "eth_signTypedData"];

        // const authPayload = populateAuthPayload({
        //     authPayload: payload.params.authPayload,
        //     chains: supportedChains,
        //     methods: supportedMethods,
        // });

        // const iss = `aztec:31337:${account.address}`
        // const message = this.walletKit?.formatAuthMessage({
        //     request: authPayload,
        //     iss,
        // });

        // const signature = await this.accounts.signPayload("9181ab0c", 31337, account.address, message)

        // const auth = buildAuthObject(
        //     authPayload,
        //     { t: 'eip191', s: signature },
        //     iss
        // );

        // await this.walletKit?.approveSessionAuthenticate({
        //     id: payload.id,
        //     auths: [auth],
        // });
    };

    private readonly onDappSessionUpdated = async (dappSession: DappSession) => {
        if (!this.walletKit) {
            this.logWarn("WC session wasn't updated");
            return;
        }
        try {
            const sessions = this.walletKit.getActiveSessions();
            if (dappSession.id in sessions) {
                this.walletKit.updateSession({
                    topic: dappSession.id,
                    namespaces: this.buildSessionNamespaces(
                        sessions[dappSession.id].requiredNamespaces,
                        sessions[dappSession.id].optionalNamespaces,
                        dappSession.permissions,
                        dappSession.accounts,
                    ),
                });
            }
        } catch (error) {
            this.logError("Failed to update WC session", getErrorMessage(error));
        }
    };

    private readonly onDappSessionDeleted = async (dappSession: DappSession) => {
        if (!this.walletKit) {
            this.logWarn("WC session wasn't disconnected");
            return;
        }
        try {
            const sessions = this.walletKit.getActiveSessions();
            if (dappSession.id in sessions) {
                this.walletKit.disconnectSession({
                    topic: dappSession.id,
                    reason: getSdkError("USER_DISCONNECTED"),
                });
            }
        } catch (error) {
            this.logError("Failed to disconnect WC session", getErrorMessage(error));
        }
    };

    private async rejectSession(proposalId: number) {
        try {
            await this.walletKit!.rejectSession({
                id: proposalId,
                reason: getSdkError("USER_REJECTED"),
            });
        } catch {}
    }

    private async disconnectSession(sessionTopic: string) {
        try {
            await this.walletKit!.disconnectSession({
                topic: sessionTopic,
                reason: getSdkError("USER_DISCONNECTED"),
            });
        } catch {}
    }

    private async rejectRequest(request: WalletKitTypes.SessionRequest, reason: string) {
        try {
            await this.walletKit!.respondSessionRequest({
                topic: request.topic,
                response: {
                    id: request.id,
                    error: {
                        code: 5000,
                        message: reason,
                    },
                    jsonrpc: "2.0",
                },
            });
        } catch {}
    }

    private async respondRequest(request: WalletKitTypes.SessionRequest, result: unknown) {
        await this.walletKit!.respondSessionRequest({
            topic: request.topic,
            response: {
                id: request.id,
                result,
                jsonrpc: "2.0",
            },
        });
    }

    private buildSessionNamespaces(
        required: ProposalTypes.RequiredNamespaces,
        optional: ProposalTypes.OptionalNamespaces,
        permissions: DappPermissions[],
        accounts: string[],
    ): SessionTypes.Namespaces {
        const namespaces: SessionTypes.Namespaces = {};
        for (const [k, v] of Object.entries(required)) {
            namespaces[k] = {
                ...v,
                accounts: (v.chains ?? [k]).flatMap(c => accounts.filter(a => a.startsWith(c))),
            };
        }
        const flatOptional = Object.entries(optional).flatMap(([k, v]) =>
            (v.chains ?? [k]).map(c => [c, v] as [string, ProposalTypes.BaseRequiredNamespace]),
        );
        for (const [k, v] of flatOptional) {
            const methods = v.methods.filter(m =>
                (v.chains ?? [k]).every(c => permissions.find(p => p.chains?.includes(c) && p.methods?.includes(m))),
            );
            const events = v.events.filter(e =>
                (v.chains ?? [k]).every(c => permissions.find(p => p.chains?.includes(c) && p.events?.includes(e))),
            );
            if (methods.length || events.length) {
                if (k in namespaces) {
                    for (const method of methods) {
                        if (!namespaces[k].methods.includes(method)) {
                            namespaces[k].methods.push(method);
                        }
                    }
                    for (const event of events) {
                        if (!namespaces[k].events.includes(event)) {
                            namespaces[k].events.push(event);
                        }
                    }
                } else {
                    const approvedAccounts = (v.chains ?? [k]).flatMap(c => accounts.filter(a => a.startsWith(c)));
                    if (approvedAccounts.length) {
                        namespaces[k] = {
                            methods,
                            events,
                            accounts: approvedAccounts,
                        };
                    }
                }
            }
        }
        // explicitly allow root methods
        for (const namespace of Object.values(namespaces)) {
            if (namespace.methods.length) {
                if (!namespace.methods.includes(RpcMethod.get_wallet_info)) {
                    namespace.methods.push(RpcMethod.get_wallet_info);
                }
                if (!namespace.methods.includes(RpcMethod.get_session)) {
                    namespace.methods.push(RpcMethod.get_session);
                }
                if (!namespace.methods.includes(RpcMethod.close_session)) {
                    namespace.methods.push(RpcMethod.close_session);
                }
                if (!namespace.methods.includes(RpcMethod.connect)) {
                    namespace.methods.push(RpcMethod.connect);
                }
                if (!namespace.methods.includes(RpcMethod.execute)) {
                    namespace.methods.push(RpcMethod.execute);
                }
            }
        }
        return namespaces;
    }
}
