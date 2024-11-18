import {
    AztecAddress,
    deriveKeys,
    Fr,
    getContractInstanceFromDeployParams,
    GrumpkinScalar,
    loadContractArtifact,
    NoirCompiledContract,
    Schnorr
} from '@aztec/aztec.js';
import { sha512ToGrumpkinScalar } from '@aztec/foundation/crypto';

import compiled from './azguard-v0.json' with { type: "json" };
const azguardV0Artifact = loadContractArtifact(compiled as NoirCompiledContract);

export class AzguardV0 {
    public static getAddress(secret: Fr): AztecAddress {
        const signingKey = this._deriveSigningKey(secret);
        const signingPublicKey = new Schnorr().computePublicKey(signingKey);
        const instance = getContractInstanceFromDeployParams(
            azguardV0Artifact,
            {
                constructorArgs: [signingPublicKey.x, signingPublicKey.y],
                publicKeys: deriveKeys(secret).publicKeys,
                salt: Fr.zero(),
            }
        );
        return instance.address;
    }

    public static signPayload(payload: Uint8Array, secret: Fr): string {
        const signingKey = this._deriveSigningKey(secret);
        return new Schnorr().constructSignature(payload, signingKey).toString();
    }

    private static _deriveSigningKey(secret: Fr): GrumpkinScalar {
        return sha512ToGrumpkinScalar([secret, 257]);
    }
}