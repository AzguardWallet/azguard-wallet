import { getRandomHex, Lock } from "@/wallet/utils";
import {
    M_HANDSHAKE,
    M_MESSAGE,
    decrypt,
    deriveEncryptionKey,
    encrypt,
    exportPublicKey,
    generateKeyPair,
    importPublicKey,
} from "./utils";

export class MClient<TMessage> {
    #channel: string;
    #identity: string;
    #pair?: CryptoKeyPair;
    #onMessage: (message: TMessage) => void;
    
    #lock: Lock;
    #handshake: Promise<void>;
    #handshakeResolve: (result: void) => void = null!;
    #handshakeReject: (error: string) => void = null!;
    #key?: CryptoKey | null;

    public constructor(channel: string, onMessage: (message: TMessage) => void) {
        this.#channel = channel;
        this.#identity = getRandomHex(8);
        this.#onMessage = onMessage;

        this.#lock = new Lock();
        this.#handshake = new Promise((resolve, reject) => {
            this.#handshakeResolve = resolve;
            this.#handshakeReject = reject;
        });
        this.#key = undefined;
        this.#initKeys();
    }

    async #initKeys() {
        try {
            this.#pair = await generateKeyPair();
            const pubkey = await exportPublicKey(this.#pair.publicKey);
            
            window.addEventListener("message", this.#processMessageEvent);
            window.postMessage(
                {
                    channel: this.#channel,
                    from: this.#identity,
                    type: M_HANDSHAKE,
                    payload: pubkey,
                },
                window.origin,
            );
        }
        catch (error) {
            console.error("Initialization failed", error);
        }
    }

    public async send(message: any) {
        try {
            await this.#handshake;
            if (this.#key === null) {
                throw new Error("Client is blocked");
            }
            window.postMessage(
                {
                    channel: this.#channel,
                    from: this.#identity,
                    type: M_MESSAGE,
                    payload: await encrypt<any>(message, this.#key!),
                },
                window.origin,
            );
        }
        catch (error) {
            console.error(error);
            throw new Error("Failed to send message");
        }
    }

    readonly #processMessageEvent = async ({data, source}: MessageEvent) => {
        if (source !== window) {
            // ignore other sources
            return;
        }
        if (data?.channel !== this.#channel) {
            // ignore other channels
            return;
        }
        if (data?.to !== this.#identity) {
            // ignore other recepients
            return;
        }
        if (!data.type || typeof data.type !== "string" ||
            !data.payload || typeof data.payload !== "string"
        ) {
            // ignore invalid messages
            return;
        }
        switch (data.type) {
            case M_HANDSHAKE: {
                await this.#processHandshake(data.payload);
                break;
            }
            case M_MESSAGE: {
                await this.#processMessage(data.payload);
                break;
            }
            default: {
                console.warn("Invalid message type");
                return;
            }
        }
    }

    async #processHandshake(payload: string) {
        try {
            await this.#lock.enter();
            if (this.#key) {
                // mitm protection
                console.warn("Suspicious handshake received. Client is blocked for security reasons.");
                window.removeEventListener("message", this.#processMessageEvent);
                this.#key = null;
                return;
            }
            if (this.#key === null) {
                // client is blocked
                return;
            }
            try {
                const publicKey = await importPublicKey(payload);
                this.#key = await deriveEncryptionKey(this.#pair!.privateKey, publicKey);
                this.#handshakeResolve();
            }
            catch {
                console.warn("Handshake failed. Client is blocked for security reasons.");
                window.removeEventListener("message", this.#processMessageEvent);
                this.#key = null;
                this.#handshakeReject("handshake failed");
                return;
            }
        }
        finally {
            this.#lock.leave();
        }
    }

    async #processMessage(payload: string) {
        try {
            await this.#handshake;
            const message = await decrypt<any>(payload, this.#key!);
            try {this.#onMessage(message)} catch {}
        }
        catch {
            console.warn("Failed to process message");
        }
    }
}
