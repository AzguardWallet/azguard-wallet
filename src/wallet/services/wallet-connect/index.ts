import { sleep } from "../../utils/sleep";
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import type { InteractionService } from "@/wallet/services/interaction";
import type { DappSession, Namespaces } from "@/wallet/services/interaction/client";
import type { Account } from '../account/client';
import { Service } from "@/wallet/base/service";
import {
    type ConnectByURIRequest,
    ConnectByURIResponse,
    type ApproveDappSessionRequest,
    ApproveDappSessionResponse,
    type RejectDappSessionRequest,
    RejectDappSessionResponse,
    type DropDappSessionRequest,
    DropDappSessionResponse,
    type ValidateProposalRequest,
    ValidateProposalResponse,
    type ConfirmSessionRequestRequest,
    ConfirmSessionRequestResponse,
    type RejectSessionRequestRequest,
    RejectSessionRequestResponse,
    WALLET_CONNECT_SERVICE_NAME,
    WalletConnectServiceMethod,
    WalletConnectServiceEventMessage,
    WalletConnectServiceEvent,
    WCSessionParams,
} from "./client";

type LogLevel = "trace" | "debug" | "info" | "error" | "silent"

const WALLET_CONNECT_PROJECT_ID = "d809b7373c4209e576c9033266578783"
const WALLET_CONNECT_METADATA = {
    name: "Azguard Wallet",
    description: "Azguard Wallet Description",
    url: "https://azguardwallet.io",
    icons: [],
}
const WALLET_CONNECT_LOG_LEVEL = "silent"

const CAIP_PREFIX = "aztec";
const CAIP = {
    chain(chainId: number) {
        return `${CAIP_PREFIX}:${chainId}`;
    },
    address(chainId: number, address: string) {
        return `${CAIP_PREFIX}:${chainId}:${address}`;
    },
};
const AZTEC_METHODS = ["aztec_execute"]
const AZTEC_EVENTS = ["accountsChanged"]

export class WalletConnectService extends Service {
    private walletKit: InstanceType<typeof WalletKit> | null = null;

    constructor(
        private readonly interaction: InteractionService,
        emit: (event: EventMessage) => void
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, emit)
        this.init()
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case WalletConnectServiceMethod.ConnectByURI: {
                const _request = request as ConnectByURIRequest;
                try {
                    await this.connectByURI(_request.uri)
                    
                    return new ConnectByURIResponse(_request, true);
                }

                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new ConnectByURIResponse(_request, false, error.message);
                    }

                    return new ConnectByURIResponse(_request, false, 'Unknown error occurred');
                }
            }
            case WalletConnectServiceMethod.ValidateProposal: {
                const _request = request as ValidateProposalRequest;
                try {
                    const result = await this.validateProposal(_request.payload, new Map(_request.addressesEntries))
                    
                    return new ValidateProposalResponse(_request, result);
                }

                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new ValidateProposalResponse(_request, undefined, error.message);
                    }

                    return new ValidateProposalResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            // case WalletConnectServiceMethod.ApproveDappSession: {
            //     const _request = request as ApproveDappSessionRequest;
            //     try {
            //         const dappSession = await this.approveSession(_request.payload, _request.profileId, _request.chainIds, _request.accounts)
            //         return new ApproveDappSessionResponse(_request, dappSession);
            //     }

            //     catch (error: unknown) {
            //         if (error instanceof Error) {
            //             return new ApproveDappSessionResponse(_request, undefined, error.message);
            //         }

            //         return new ApproveDappSessionResponse(_request, undefined, 'Unknown error occurred');
            //     }
            // }
            case WalletConnectServiceMethod.RejectDappSession: {
                const _request = request as RejectDappSessionRequest;
                try {
                    const result = await this.rejectSession(_request.payload)

                    return new RejectDappSessionResponse(_request, result);
                }

                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new RejectDappSessionResponse(_request, undefined, error.message);
                    }

                    return new RejectDappSessionResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            // case WalletConnectServiceMethod.DropDappSession: {
            //     const _request = request as DropDappSessionRequest;
            //     try {
            //         await this.dropDappSession(_request.dappSession)

            //         return new DropDappSessionResponse(_request, true);
            //     }

            //     catch (error: unknown) {
            //         if (error instanceof Error) {
            //             return new DropDappSessionResponse(_request, false, error.message);
            //         }

            //         return new DropDappSessionResponse(_request, false, 'Unknown error occurred');
            //     }
            // }
            case WalletConnectServiceMethod.ConfirmSessionRequest: {
                const _request = request as ConfirmSessionRequestRequest;
                try {
                    const txHash = await this.confirmSessionRequest(_request.networkId, _request.accountAddress, _request.dappName, _request.payload)

                    return new ConfirmSessionRequestResponse(_request, txHash);
                }

                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new ConfirmSessionRequestResponse(_request, undefined, error.message);
                    }

                    return new ConfirmSessionRequestResponse(_request, undefined, 'Unknown error occurred');
                }
            }
            case WalletConnectServiceMethod.RejectSessionRequest: {
                const _request = request as RejectSessionRequestRequest;
                try {
                    await this.rejectSessionRequest(_request.payload)

                    return new RejectSessionRequestResponse(_request, true);
                }

                catch (error: unknown) {
                    if (error instanceof Error) {
                        return new RejectSessionRequestResponse(_request, false, error.message);
                    }

                    return new RejectSessionRequestResponse(_request, false, 'Unknown error occurred');
                }
            }

            default: {
                console.error(`Invalid request method ${request.method}.`);

                return undefined;
            }                
        }
    }

    public async init(): Promise<void> {
        while (true) {
            try {
                const core = new Core({
                    projectId: WALLET_CONNECT_PROJECT_ID,
                    logger: WALLET_CONNECT_LOG_LEVEL,
                })

                this.configureLoggers(core, WALLET_CONNECT_LOG_LEVEL)
        
                this.walletKit = await WalletKit.init({
                    core,
                    metadata: WALLET_CONNECT_METADATA,
                })
        
                this.setupWalletKitEvents()

                console.debug("Wallet connect service initialized");

                this.interaction.onDappSessionDroped.push(this.dropDappSession)

                break
            } catch (error) {
                console.error("Failed to initialize wallet connect service. Retry...");
                await sleep(1000)
            }
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private createLogger(level: LogLevel): any {
        const noop = () => {}
        return {
            error: level !== 'silent' ? console.error : noop,
            warn: level !== 'silent' ? console.warn : noop,
            debug: ['trace', 'debug', 'info'].includes(level) ? console.debug : noop,
            info: ['trace', 'debug', 'info'].includes(level) ? console.info : noop,
            trace: level === 'trace' ? console.trace : noop,
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private configureLoggers = (core: any, level: LogLevel) => {
        const loggerConfig = this.createLogger(level)
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
            const keys = path.split('.')
            const target = keys.reduce((obj, key) => obj[key], core)
            Object.assign(target, loggerConfig)
        })
    }
    

    private setupWalletKitEvents(): void {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        // type Event = "session_proposal" | "session_request" | "session_delete" | "proposal_expire" | "session_request_expire" | "session_authenticate";

        this.walletKit.on('session_proposal', async (payload) => this.handleSessionProposal(payload))

        this.walletKit.on('proposal_expire', async (payload) => this.handleProposalExpire(payload))

        this.walletKit.on('session_delete', async (payload) => this.handleSessionDelete(payload))

        this.walletKit.on('session_request', async (payload) => this.handleSessionRequest(payload));

        this.walletKit.on('session_request_expire', async (payload) => this.handleSessionRequestExpire(payload));

        this.walletKit.on('session_authenticate', async (payload) => this.handleSessionAuthenticate(payload))

        console.debug("WalletKit event handlers set up.");
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async connectByURI(uri: string): Promise<any> {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.")
        }

        try {
            await this.walletKit.pair({ uri })

            return true
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(error.message)
            }

            throw new Error("Unknown error occurred")
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async validateProposal(payload: any, addresses: Map<number, string>): Promise<any> {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.")
        }
        
        try {
            const approvedNamespaces = buildApprovedNamespaces({
                proposal: payload.params,
                supportedNamespaces: {
                    aztec: {
                        chains: Array.from(addresses, ([chainId, _]) => CAIP.chain(chainId)),
                        methods: AZTEC_METHODS,
                        events: AZTEC_EVENTS,
                        accounts: Array.from(addresses, ([chainId, address]) => CAIP.address(chainId, address)),
                    },
                },
            })

            return approvedNamespaces
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(error.message)
            }

            throw new Error("Unknown error occurred")
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async handleSessionProposal(payload: any): Promise<any> {
        console.debug('Session proposal received', payload);

        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        try {
            const { namespaces, profileId } = await this.interaction.dappSessionProposal(payload)
            try {
                if (namespaces && profileId)
                this.approveSession(payload, namespaces, profileId)
            } catch (err) {
                console.error(err);
            }
        } catch (err) {
            this.rejectSession(payload)
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async approveSession(payload: any, namespaces: Namespaces, profileId: string): Promise<DappSession | undefined> {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }
        
        const approvedNamespaces = buildApprovedNamespaces({
            proposal: payload.params,
            supportedNamespaces: namespaces as Record<string, { chains: string[]; methods: string[]; events: string[]; accounts: string[]; }>,
        })

        try {
            const session = await this.walletKit.approveSession({
                id: payload.id,
                namespaces: approvedNamespaces,
            })
    
            if (!session) return undefined
            
            const { icons, ...metadata } = session.peer.metadata
            const dappMetadata = {
                ...metadata,
                icon: icons.length > 0 ? icons[0] : "",
            }
            
            const dappSession = await this.interaction.addDappSession(
                dappMetadata, approvedNamespaces, session.expiry, profileId, session.topic, true
            )
            
            return dappSession
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(error.message)
            }

            throw new Error("Unknown error occurred")
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async rejectSession(payload: any): Promise<boolean> {
        await this.walletKit?.rejectSession({
            id: payload.id,
            reason: getSdkError("USER_REJECTED"),
        })

        return true
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async handleProposalExpire(payload: any): Promise<any> {
        console.debug('Session proposal expire received', payload);

        this.interaction.requestExpired(payload)
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async handleSessionRequest(payload: any): Promise<any> {
        console.debug('Session request received', payload);

        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        try {
            const result = await this.interaction.dappSessionRequest(payload)
            console.log('handleSessionRequest result', result);
            
            try {
                const { networkId, accountAddress, dappName } = result
                console.log('handleSessionRequest networkId', networkId);
                console.log('handleSessionRequest accountAddress', accountAddress);
                console.log('handleSessionRequest dappName', dappName);
                if (networkId && accountAddress && dappName ) {

                    try {
                        const txHash = await this.interaction.executeDappSessionRequest(networkId, accountAddress, dappName, payload.params?.request?.params)

                        if (txHash) {
                            const response = {
                                id: payload.id,
                                result: txHash,
                                jsonrpc: '2.0',
                            }
                            
                            this.walletKit.respondSessionRequest({ topic: payload.topic, response })
                        }
                    } catch (err) {
                        console.error(err);
                        this.rejectSessionRequest(payload)
                    }
                }
            } catch (err) {
                console.error(err);
                this.rejectSessionRequest(payload)
            }
        } catch (err) {
            this.rejectSessionRequest(payload)
        }
        // this.interaction.dappSessionRequest(payload)
    }
    
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async confirmSessionRequest(networkId: string, accountAddress: string, dappName: string, payload: any): Promise<string> {
        try {
            const txHash = await this.interaction.executeDappSessionRequest(networkId, accountAddress, dappName, payload.params?.request?.params)

            const response = {
                id: payload.id,
                result: txHash,
                jsonrpc: '2.0',
            }

            await this.walletKit?.respondSessionRequest({ topic: payload.topic, response })
    
            return txHash
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(error.message);
            }

            throw new Error("Unknown error occurred");
        }
    }
    
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async rejectSessionRequest(payload: any): Promise<boolean> {
        const response = {
            id: payload.id,
            jsonrpc: '2.0',
            error: {
                code: 5000,
                message: 'User rejected.',
            },
        }

        await this.walletKit?.respondSessionRequest({ topic: payload.topic, response })

        return true
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async handleSessionRequestExpire(payload: any): Promise<any> {
        console.debug('Session request expire received', payload);
        
        this.interaction.requestExpired(payload)
        // this.emit(new WalletConnectServiceEventMessage(WalletConnectServiceEvent.RequestExpire, payload));
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async handleSessionDelete(payload: any): Promise<any> {
        console.debug('Session delete received', payload);

        this.interaction.dropDappSession(payload.topic, true)
    }
    
    public readonly dropDappSession = async (dappSession: DappSession) => {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        try {
            const sessions = this.walletKit.getActiveSessions()
            if (Object.keys(sessions).includes(dappSession.id)) {
                this.walletKit.disconnectSession({
                    topic: dappSession.id,
                    reason: getSdkError('USER_DISCONNECTED')
                })
            }
        } catch (err) {

        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private async _buildDappSessionParams(session: any): Promise<WCSessionParams> {
        const chains: string[] = [];
        const methods: string[] = [];
        const events: string[] = [];
        
        const namespaces = session.namespaces
        for (const key in namespaces) {
            const ns = namespaces[key];
            if (ns.chains) {
                chains.push(...ns.chains);
            }
            if (ns.methods) {
                methods.push(...ns.methods);
            }
            if (ns.events) {
                events.push(...ns.events);
            }
        }
    
        return new WCSessionParams(
            session.topic,
            session.expiry,
            [...new Set(chains)],
            [...new Set(methods)],
            [...new Set(events)]
        );
    }


    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public async handleSessionAuthenticate(payload: any): Promise<any> {
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

        // console.log('namespaces', namespaces);
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
}