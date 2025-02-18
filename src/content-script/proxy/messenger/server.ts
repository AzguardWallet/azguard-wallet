import { Lock } from "@/wallet/utils";
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

export class MServer<TMessage> {
    #channel: string;
    #onMessage: (client: string, message: TMessage) => void;
    #init: Promise<void>;
    #pair?: CryptoKeyPair;
    
    #clients: Map<string, CryptoKey> = new Map();
    #lock: Lock = new Lock();

    public constructor(channel: string, onMessage: (client: string, message: TMessage) => void) {
        this.#channel = channel;
        this.#onMessage = onMessage;
        window.addEventListener("message", this.#processMessageEvent);
        this.#init = this.#initKeys();
    }

    async #initKeys() {
        try {
            this.#pair = await generateKeyPair();
        }
        catch (error) {
            console.error("Initialization failed", error);
            throw new Error("Initialization failed");
        }
    }

    public async send(client: string, message: any) {
        try {
            if (!this.#clients.has(client)) {
                throw new Error("Unknown client");
            }
            window.postMessage(
                {
                    channel: this.#channel,
                    to: client,
                    type: M_MESSAGE,
                    payload: await encrypt(message, this.#clients.get(client)!),
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
        if (data?.from === undefined) {
            // ignore outgoing
            return;
        }
        if (!data.from || typeof data.from !== "string" ||
            !data.type || typeof data.type !== "string" ||
            !data.payload || typeof data.payload !== "string"
        ) {
            // ignore invalid messages
            return;
        }
        switch (data.type) {
            case M_HANDSHAKE: {
                await this.#processHandshake(data.from, data.payload);
                break;
            }
            case M_MESSAGE: {
                await this.#processMessage(data.from, data.payload);
                break;
            }
            default: {
                console.warn("Invalid message type");
                return;
            }
        }
    }

    async #processHandshake(client: string, payload: string) {
        try {
            await this.#lock.enter();
            if (this.#clients.has(client)) {
                return;
            }
            try {
                await this.#init;
                const ownPublicKey = await exportPublicKey(this.#pair!.publicKey);
                const publicKey = await importPublicKey(payload);
                const key = await deriveEncryptionKey(this.#pair!.privateKey, publicKey);
                this.#clients.set(client, key);
                
                window.postMessage(
                    {
                        channel: this.#channel,
                        to: client,
                        type: M_HANDSHAKE,
                        payload: ownPublicKey,
                    },
                    window.origin,
                );
            }
            catch {
                console.warn("Handshake failed.");
            }
        }
        finally {
            this.#lock.leave();
        }
    }

    async #processMessage(client: string, payload: string) {
        if (!this.#clients.has(client)) {
            return;
        }
        try {
            const message = await decrypt<any>(payload, this.#clients.get(client)!);
            try {this.#onMessage(client, message)} catch {}
        }
        catch {
            console.warn("Failed to process message");
        }
    }
}