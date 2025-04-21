import { WalletKit, type WalletKitTypes } from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import { getSdkError } from "@walletconnect/utils";

import { Service } from "@/wallet/base/service";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import type { DappSessionService } from "@/wallet/services/dapp-session";
import type { DappMetadata, DappPermissions, DappSession } from "@/wallet/services/dapp-session/client";
import type { DappInteractionService } from '@/wallet/services/dapp-interaction';
import type { ConnectionParams, DappSessionInfo, ExecutionParams } from "@/wallet/services/dapp-interaction/types";
import { AzguardWalletInfo, RpcMethod } from '@/wallet/services/rpc/types';
import { parseExecutionParams, parseConnectionParams } from '@/wallet/services/rpc/utils';
import { sleep } from "@/wallet/utils/sleep";
import {
    WALLET_CONNECT_SERVICE_NAME,
    type ConnectByURIRequest,
    ConnectByURIResponse,
    WalletConnectServiceMethod,
} from "./client";


export class WalletConnectService extends Service {
    private walletKit?: InstanceType<typeof WalletKit>;

    public constructor(
        private readonly dappSessions: DappSessionService,
        private readonly dappInteractions: DappInteractionService,
        emit: (event: EventMessage) => void
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, emit);
        this.init();
    }

    private async init() {
        while (true) {
            try {
                const WALLET_CONNECT_PROJECT_ID = "d809b7373c4209e576c9033266578783";
                const WALLET_CONNECT_METADATA = {
                    name: AzguardWalletInfo.name,
                    description: AzguardWalletInfo.description,
                    url: AzguardWalletInfo.url,
                    icons: [
                        AzguardWalletInfo.logo,
                    ],
                }
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
                this.walletKit.on('session_proposal', this.onSessionProposal);
                this.walletKit.on('proposal_expire', this.onProposalExpire);
                this.walletKit.on('session_request', this.onSessionRequest);
                this.walletKit.on('session_request_expire', this.onSessionRequestExpire);
                this.walletKit.on('session_delete', this.onSessionDelete);
                this.walletKit.on('session_authenticate', this.onSessionAuthenticate);

                this.dappSessions.onDappSessionUpdated.push(this.onDappSessionUpdated);
                this.dappSessions.onDappSessionDeleted.push(this.onDappSessionDeleted);

                for (const topic of Object.keys(this.walletKit.getActiveSessions())) {
                    if (!await this.dappSessions.tryGetDappSession(topic)) {
                        this.disconnectSession(topic);
                    }
                }

                console.debug("Wallet connect service initialized");
                break;
            } catch (error) {
                console.error("Failed to initialize wallet connect service. Retry...", error);
                await sleep(1000);
            }
        }
    }

    private configureLoggers = (core: InstanceType<typeof Core>, level: string) => {
        const noop = () => {};
        const loggerConfig = {
            error: level !== "silent" ? console.error : noop,
            warn: ["warn", "info", "debug", "trace"].includes(level) ? console.warn : noop,
            info: ["info", "debug", "trace"].includes(level) ? console.info : noop,
            debug: ["debug", "trace"].includes(level) ? console.debug : noop,
            trace: level === "trace" ? console.trace : noop,
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
        ]
        // biome-ignore lint/complexity/noForEach: <explanation>
        paths.forEach(path => {
            const keys = path.split('.');
            const target = keys.reduce((obj, key) => obj[key], core as any);
            Object.assign(target, loggerConfig);
        });
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case WalletConnectServiceMethod.ConnectByURI: {
                const _request = request as ConnectByURIRequest;
                try {
                    await this.connectByURI(_request.uri);
                    return new ConnectByURIResponse(_request);
                }
                catch (error: unknown) {
                    return new ConnectByURIResponse(_request, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    private async connectByURI(uri: string) {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }
        await this.walletKit.pair({ uri });
    }

    private readonly onSessionProposal = async (payload: WalletKitTypes.SessionProposal) => {
        console.debug('WC: session proposal received', payload);
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
                ([k, v]) => ({...v, chains: v.chains?.length ? v.chains : [k]}),
            );
            const optionalPermissions: DappPermissions[] = Object.entries(payload.params.optionalNamespaces).map(
                ([k, v]) => ({...v, chains: v.chains?.length ? v.chains : [k]}),
            );
            const params: ConnectionParams = parseConnectionParams({
                dappMetadata,
                requiredPermissions,
                optionalPermissions,
            });
            dappSession = await this.dappInteractions.connect(params, payload.params.id.toString());
        }
        catch (error) {
            console.debug("WC: session proposal rejected", error);
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
        }
        catch (error) {
            console.debug("WC: session approval failed", error);
            this.dappSessions.deleteDappSession(dappSession.id);
            this.rejectSession(payload.id);
            return;
        }
        // upgrade dapp session
        try {
            await this.dappSessions.upgradeDappSession(dappSession.id, wcSession.topic, wcSession.expiry * 1000);
        }
        catch (error) {
            console.debug("WC: session upgrade failed", error);
            this.dappSessions.deleteDappSession(dappSession.id);
            this.disconnectSession(wcSession.topic);
            return;
        }
    }

    private readonly onProposalExpire = async (payload: WalletKitTypes.ProposalExpire) => {
        console.debug('WC: proposal expire received', payload);
        this.dappInteractions.cancelInteraction(payload.id.toString());
    }

    private readonly onSessionRequest = async (payload: WalletKitTypes.SessionRequest) => {
        console.debug('WC: session request received', payload);
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
                    throw new Error(`'${payload.params.request.method}' cannot be invoked directly, but as a part of a batch`);
                }
            }
        }
        catch (error) {
            console.debug("WC: session request failed", error);
            this.rejectRequest(payload, (error as Error)?.message ?? error as string ?? "Unknown error");
        }
    }

    private readonly onSessionRequestExpire = async (payload: WalletKitTypes.SessionRequestExpire) => {
        console.debug('WC: session request expire received', payload);
        this.dappInteractions.cancelInteraction(payload.id.toString());
    }

    private readonly onSessionDelete = async (payload: WalletKitTypes.SessionDelete) => {
        console.debug('WC: session delete received', payload);
        this.dappSessions.deleteDappSession(payload.topic)
    }

    private readonly onSessionAuthenticate = async (payload: WalletKitTypes.SessionAuthenticate) => {
        console.debug('Session authenticate received', payload);

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
    }
    
    private readonly onDappSessionUpdated = async (dappSession: DappSession) => {
        if (!this.walletKit) {
            console.warn("WC session wasn't updated");
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
        }
        catch (error) {
            console.error("Failed to update WC session", error);
        }
    }
    
    private readonly onDappSessionDeleted = async (dappSession: DappSession) => {
        if (!this.walletKit) {
            console.warn("WC session wasn't disconnected");
            return;
        }
        try {
            const sessions = this.walletKit.getActiveSessions();
            if (dappSession.id in sessions) {
                this.walletKit.disconnectSession({
                    topic: dappSession.id,
                    reason: getSdkError('USER_DISCONNECTED')
                });
            }
        }
        catch (error) {
            console.error("Failed to disconnect WC session", error);
        }
    }

    private async rejectSession(proposalId: number) {
        try {
            await this.walletKit!.rejectSession({
                id: proposalId,
                reason: getSdkError("USER_REJECTED"),
            });
        }
        catch {}
    }

    private async disconnectSession(sessionTopic: string) {
        try {
            await this.walletKit!.disconnectSession({
                topic: sessionTopic,
                reason: getSdkError('USER_DISCONNECTED')
            });
        }
        catch {}
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
                }
            });
        }
        catch {}
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
        const flatOptional = Object.entries(optional).flatMap(
            ([k, v]) => (v.chains ?? [k]).map(
                c => [c, v] as [string, ProposalTypes.BaseRequiredNamespace]
            )
        );
        for (const [k, v] of flatOptional) {
            const methods = v.methods.filter(m => (v.chains ?? [k]).every(c => permissions.find(p => p.chains?.includes(c) && p.methods?.includes(m))));
            const events = v.events.filter(e => (v.chains ?? [k]).every(c => permissions.find(p => p.chains?.includes(c) && p.events?.includes(e))));
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
                }
                else {
                    const approvedAccounts = (v.chains ?? [k]).flatMap(c => accounts.filter(a => a.startsWith(c)))
                    if (approvedAccounts.length) {
                        namespaces[k] = {
                            methods,
                            events,
                            accounts: approvedAccounts,
                        }
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