import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildAuthObject, parseUri, populateAuthPayload } from '@walletconnect/utils';
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex } from "@/wallet/utils";
// import {
//     AddNetworkRequest,
//     AddNetworkResponse,
//     DeleteNetworkRequest,
//     DeleteNetworkResponse,
//     GetNetworkRequest,
//     GetNetworkResponse,
//     GetNetworksRequest,
//     GetNetworksResponse,
//     Network,
//     WALLET_CONNECT_SERVICE_NAME,
//     NetworkServiceEvent,
//     NetworkServiceEventMessage,
//     NetworkServiceMethod,
//     UpdateNetworkRequest,
//     UpdateNetworkResponse
// } from "./client";

const WALLET_CONNECT_SERVICE_NAME = "wallet-connect";

const WALLET_CONNECT_PROJECT_ID = "d809b7373c4209e576c9033266578783"
const WALLET_CONNECT_METADATA = {
    name: 'Azguard Wallet',
    description: 'Azguard Wallet Description',
    url: 'https://aztec.network',
    icons: [],
}
const WALLET_CONNECT_URL = "wc:0aa87b8095538f7b141d1f2f5eb01386b45650c1f64d26f5542d44640113334c@2?expiryTimestamp=1731854164&methods=wc_sessionAuthenticate&relay-protocol=irn&symKey=17206282ac82c4ab7f9a56e9b2563547400e456ac2bcbd934ba3fc1d35bc285c"

export class WalletConnectService extends Service {
    private walletKit: InstanceType<typeof WalletKit> | null = null;

    constructor(emit: (event: EventMessage) => void) {
        super(WALLET_CONNECT_SERVICE_NAME, emit);
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

        await this.onConnect(WALLET_CONNECT_URL)
    }

    private setupWalletKitEvents(): void {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        this.walletKit.on('session_authenticate', async (payload) => {
            console.log('Session authenticate received', payload);

            const namespaces = buildApprovedNamespaces({
                proposal: payload.params,
                supportedNamespaces: {
                    aztec: {
                        chains: "aztec:1",
                        methods: ["personal_sign"],
                        events: ["accountsChanged", "chainChanged"],
                        accounts: ["aztec:1:0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb"],
                    },
                },
            });

            console.log('namespaces', namespaces);
            

            await this.walletKit.approveSession({
                id: payload.id,
                namespaces,
            });
    
            // const supportedChains = ["eip155:1", "eip155:2", 'eip155:137'];
            // const supportedMethods = ["personal_sign", "eth_sendTransaction", "eth_signTypedData"];

            // const authPayload = populateAuthPayload({
            //     authPayload: payload.params.authPayload,
            //     chains: supportedChains,
            //     methods: supportedMethods,
            // });

            // const iss = `eip155:1:${ethPublic}`;
            // const message = this.walletKit?.formatAuthMessage({
            //     request: authPayload,
            //     iss,
            // });

            // const signature = await ethWallet?.signMessage(message);

            // const auth = buildAuthObject(
            //     authPayload,
            //     { t: 'eip191', s: signature },
            //     iss
            // );

            // await this.walletKit!.approveSessionAuthenticate({
            //     id: payload.id,
            //     auths: [auth],
            // });
        });

        // this.walletKit.on('pairing_expire', ({ topic }) => {
        //     console.warn(`Pairing expired for topic: ${topic}`);
        // });

        // console.log("WalletKit event handlers set up.");
    }

    public async onConnect(uri: string): Promise<void> {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        const { topic: pairingTopic } = parseUri(uri);
        console.log('Connecting with pairing topic:', pairingTopic);

        try {
            await this.walletKit.pair({ uri });
            // return { success: true };
        } catch (error) {
            console.error("Failed to connect:", error);
            // return { success: false, error: error.message };
        }
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {

            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }


}