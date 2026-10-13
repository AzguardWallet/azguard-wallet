import { Fr } from '@aztec-labs/foundation/curves/bn254';
import { sha512ToGrumpkinScalar } from '@aztec-labs/foundation/crypto/sha512';
import { Schnorr } from '@aztec-labs/foundation/crypto/schnorr';
import { ContractArtifact, loadContractArtifact } from '@aztec-labs/stdlib/abi';
import { getContractInstanceFromInstantiationParams } from '@aztec-labs/stdlib/contract';
import { deriveKeys } from '@aztec-labs/stdlib/keys';
import { NoirCompiledContract } from '@aztec-labs/stdlib/noir';
import { ILogger } from '@/wallet/logger';
import { AzguardV0Base } from './azguard-v0-base';

import compiled from './azguard-v0.json' with { type: "json" };
const azguardV0Artifact = loadContractArtifact(compiled as NoirCompiledContract);

/**
 * Standard Azguard account contract
 */
export class AzguardV0 extends AzguardV0Base {
    public readonly name = "azguard-v0";
    protected readonly artifact: ContractArtifact = azguardV0Artifact;

    public static async new(secret: Fr, logger: ILogger): Promise<AzguardV0> {
        const keys = await deriveKeys(secret);
        const signingKey = sha512ToGrumpkinScalar([secret, 257]);
        const signingPubKey = await new Schnorr().computePublicKey(signingKey);
        const instance = await getContractInstanceFromInstantiationParams(
            azguardV0Artifact,
            {
                constructorArgs: [signingPubKey.x, signingPubKey.y],
                publicKeys: keys.publicKeys,
                salt: Fr.zero(),
            }
        );
        return new AzguardV0(secret, signingKey, signingPubKey, instance, logger);
    }
}
