import { Core } from '@walletconnect/core';
import { WalletKit, WalletKitTypes } from '@reown/walletkit';
import { buildAuthObject, parseUri, populateAuthPayload } from '@walletconnect/utils';
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import type { ProfileService } from "@/wallet/services/profile";
import type { NetworkService } from "@/wallet/services/network";
import type { AccountService } from "@/wallet/services/account";
import { Service } from "@/wallet/base/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex } from "@/wallet/utils";
import {
    type ConnectByURLRequest,
    ConnectByURLResponse,
    WALLET_CONNECT_SERVICE_NAME,
    WalletConnectServiceMethod,
} from "./client";

const WALLET_CONNECT_PROJECT_ID = "d809b7373c4209e576c9033266578783"
const WALLET_CONNECT_METADATA = {
    name: 'Azguard Wallet',
    description: 'Azguard Wallet Description',
    url: 'https://aztec.network',
    icons: [],
}

export class WalletConnectService extends Service {
    private walletKit: InstanceType<typeof WalletKit> | null = null;

    constructor(
        // private readonly profiles: ProfileService,
        private readonly accounts: AccountService,
        // private readonly networks: NetworkService,
        emit: (event: EventMessage) => void
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, emit);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case WalletConnectServiceMethod.ConnectByURL: {
                const _request = request as ConnectByURLRequest;
                try {
                    await this.onConnect(_request.uri)
                    return new ConnectByURLResponse(_request, true);
                }
                catch (error: any) {
                    return new ConnectByURLResponse(_request, false, error.message);
                }
            }

            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async initialize(): Promise<void> {
        const core = new Core({
            projectId: WALLET_CONNECT_PROJECT_ID,
        });

        this.walletKit = await WalletKit.init({
            core,
            metadata: WALLET_CONNECT_METADATA,
        });

        // Remove after test
        const clientId = await this.walletKit.engine.signClient.core.crypto.getClientId()
        console.log('WalletConnect ClientID: ', clientId)

        this.setupWalletKitEvents();

        // console.log('profiles', await this.profiles.getProfiles());
        // console.log('networks', await this.networks.getNetworks());
        
        // console.log('accounts', await this.accounts.getAccounts("9181ab0c", 31337));
        

        // await this.onConnect(WALLET_CONNECT_URL)
    }

    private setupWalletKitEvents(): void {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        this.walletKit.on('session_proposal', async (payload) => {
            console.log('Session proposal received', payload);

            const accounts = await this.accounts.getAccounts("9181ab0c", 31337)
            console.log('accounts', accounts.map(acc => acc.address));
            
            const account = accounts[0]

            const approvedNamespaces = buildApprovedNamespaces({
                proposal: payload.params,
                supportedNamespaces: {
                    aztec: {
                        chains: ["aztec:1"],
                        methods: [
                            "aztec_sendTransaction",
                            "aztec_experimental_createSecretHash",
                            "aztec_experimental_tokenRedeemShield",
                            "aztec_requestAccounts",
                            "aztec_accounts"
                        ],
                        events: ["accountsChanged"],
                        accounts: [`aztec:1:${account.address}`],
                    },
                    eip155: {
                        chains: ["eip155:128123"],
                        methods: [
                            "eth_accounts"
                        ],
                        events: ["accountsChanged"],
                        accounts: [`eip155:128123:${account.address}`],
                    }
                },
            })

            console.log('namespaces', approvedNamespaces);
            

            const session = await this.walletKit.approveSession({
                id: payload.id,
                namespaces: approvedNamespaces,
            });

            console.log('Approved session', session);
            
        })

        this.walletKit.on('session_request', async (payload) => {
            console.log('Session request received', payload);
        });

        this.walletKit.on('session_event', async (payload) => {
            console.log('Session event received', payload);
        });

        this.walletKit.on('session_authenticate', async (payload) => {
            console.log('Session authenticate received', payload);

            const accounts = await this.accounts.getAccounts("9181ab0c", 31337)
            const account = accounts[0]

            // const namespaces = buildApprovedNamespaces({
            //     proposal: payload?.params,
            //     supportedNamespaces: {
            //         aztec: {
            //             chains: "aztec:1",
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
    
            // const supportedChains = ["aztec:1"]
            const supportedChains = [
                "eip155:1",
                "eip155:10",
                "eip155:137",
                "eip155:324",
                "eip155:42161",
                "eip155:8453",
                "eip155:84532",
                "eip155:1301",
                "eip155:11155111",
                "eip155:100",
                "eip155:295",
                "eip155:1313161554",
                "aztec:1"
            ]
            // const supportedChains = ["eip155:1", "eip155:2", "eip155:137"]
            const supportedMethods = ["personal_sign", "eth_sendTransaction", "eth_signTypedData"];

            const authPayload = populateAuthPayload({
                authPayload: payload.params.authPayload,
                chains: supportedChains,
                methods: supportedMethods,
            });

            const iss = `aztec:1:${account.address}`
            const message = this.walletKit?.formatAuthMessage({
                request: authPayload,
                iss,
            });

            const signature = await this.accounts.signPayload("9181ab0c", 31337, account.address, message)

            const auth = buildAuthObject(
                authPayload,
                { t: 'eip191', s: signature },
                iss
            );

            await this.walletKit.approveSessionAuthenticate({
                id: payload.id,
                auths: [auth],
            });
        });

        this.walletKit.on('pairing_expire', ({ topic }) => {
            console.log(`Pairing expired for topic: ${topic}`);
        });

        console.log("WalletKit event handlers set up.");
    }

    public async onConnect(uri: string): Promise<any> {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        const { topic: pairingTopic } = parseUri(uri);
        console.log('Connecting with pairing topic:', pairingTopic);

        try {
            await this.walletKit.pair({ uri });
            console.log('walletKit.pair end');
            
        } catch (error) {
            console.error("Failed to connect:", error);
            return { success: false, error: error.message };
        }
    }
}