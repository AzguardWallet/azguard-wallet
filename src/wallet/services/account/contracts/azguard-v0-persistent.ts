import { Fr } from '@aztec/foundation/curves/bn254';
import { sha512ToGrumpkinScalar } from '@aztec/foundation/crypto/sha512';
import { Schnorr } from '@aztec/foundation/crypto/schnorr';
import { ContractArtifact, EventSelector, loadContractArtifact } from '@aztec/stdlib/abi';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { deriveKeys } from '@aztec/stdlib/keys';
import { NoirCompiledContract } from '@aztec/stdlib/noir';
import { ILogger } from '@/wallet/logger';
import { AzguardV0Base } from './azguard-v0-base';

import compiled from './azguard-v0-persistent.json' with { type: "json" };
// rc.2 artifact lacks `file_map[*].function_locations` (added in v4.2.0); runtime injects [] via @aztec/stdlib abi.ts → fillMissingFunctionLocations.
const azguardV0PersistentArtifact = loadContractArtifact(compiled as unknown as NoirCompiledContract);

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

