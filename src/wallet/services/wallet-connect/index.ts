import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildAuthObject, parseUri, populateAuthPayload } from '@walletconnect/utils';
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
const WALLET_CONNECT_URL = ""

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

        this.setupWalletKitEvents();
    }

    private setupWalletKitEvents(): void {
        if (!this.walletKit) {
            throw new Error("WalletKit is not initialized.");
        }

        this.walletKit.on('session_authenticate', async (payload) => {
            console.log('Session authenticate received', payload);

            const supportedChains = ["eip155:1", "eip155:2", 'eip155:137'];
            const supportedMethods = ["personal_sign", "eth_sendTransaction", "eth_signTypedData"];

            const authPayload = populateAuthPayload({
                authPayload: payload.params.authPayload,
                chains: supportedChains,
                methods: supportedMethods,
            });

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

    // public async onConnect(uri: string): Promise<ResponseMessage> {
    //     if (!this.walletKit) {
    //         throw new Error("WalletKit is not initialized.");
    //     }

    //     const { topic: pairingTopic } = parseUri(uri);
    //     console.log('Connecting with pairing topic:', pairingTopic);

    //     try {
    //         await this.walletKit.pair({ uri });
    //         return { success: true };
    //     } catch (error) {
    //         console.error("Failed to connect:", error);
    //         return { success: false, error: error.message };
    //     }
    // }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {

            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }


}