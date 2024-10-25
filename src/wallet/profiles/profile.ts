import { poseidon2Hash } from '@aztec/foundation/crypto';
import { Fr } from '@aztec/foundation/fields';
import { IProfile } from "../abstract/profiles";
import { EncryptionKey } from "./encryption_key";
import { ProfileInfo } from "./profile_info";

export class Profile extends ProfileInfo implements IProfile {
    public constructor(
        public readonly id: string,
        public name: string,
        private readonly secret: Uint8Array,
        private readonly key: EncryptionKey
    ) {
        super(id, name);
    }

    public async deriveChildSecret(network: string, id: number): Promise<Fr> {
        const master = await this.key.decrypt(this.secret);
        return poseidon2Hash([
            Buffer.from(master.buffer), 
            new Fr(Buffer.from(network, 'utf8')), 
            new Fr(id)]);
    }
}