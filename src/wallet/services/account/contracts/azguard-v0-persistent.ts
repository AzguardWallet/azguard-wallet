import { Fr } from '@aztec-labs/foundation/curves/bn254';
import { sha512ToGrumpkinScalar } from '@aztec-labs/foundation/crypto/sha512';
import { Schnorr } from '@aztec-labs/foundation/crypto/schnorr';
import { ContractArtifact, EventSelector, loadContractArtifact } from '@aztec-labs/stdlib/abi';
import { getContractInstanceFromInstantiationParams } from '@aztec-labs/stdlib/contract';
import { deriveKeys } from '@aztec-labs/stdlib/keys';
import { NoirCompiledContract } from '@aztec-labs/stdlib/noir';
import { ILogger } from '@/wallet/logger';
import { AzguardV0Base } from './azguard-v0-base';

import compiled from './azguard-v0-persistent.json' with { type: "json" };
const azguardV0PersistentArtifact = loadContractArtifact(compiled as NoirCompiledContract);

/**
 * Event selector for FunctionCallLog events emitted by the persistent account contract.
 * Used by the transaction indexer to query transaction history.
 */
export const FUNCTION_CALL_LOG_EVENT_SELECTOR = EventSelector.fromString("0x64658e88");

/**
 * Persistent Azguard account contract (with transaction history).
 * Emits FunctionCallLog events for each function call, enabling transaction history indexing.
 */
export class AzguardV0Persistent extends AzguardV0Base {
    public readonly name = "azguard-v0-persistent";
    protected readonly artifact: ContractArtifact = azguardV0PersistentArtifact;

    public static async new(secret: Fr, logger: ILogger): Promise<AzguardV0Persistent> {
        const keys = await deriveKeys(secret);
        const signingKey = sha512ToGrumpkinScalar([secret, 257]);
        const signingPubKey = await new Schnorr().computePublicKey(signingKey);
        const instance = await getContractInstanceFromInstantiationParams(
            azguardV0PersistentArtifact,
            {
                constructorArgs: [signingPubKey.x, signingPubKey.y],
                publicKeys: keys.publicKeys,
                salt: Fr.zero(),
            }
        );
        return new AzguardV0Persistent(secret, signingKey, signingPubKey, instance, logger);
    }
}

