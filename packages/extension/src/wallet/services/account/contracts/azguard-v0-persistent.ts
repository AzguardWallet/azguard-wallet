// Contract artifact name is "AzguardAccountPersistent" (on-chain identity).
// TypeScript wrapper uses Nulo branding. Do not rename the JSON artifact.
import { Fr } from "@aztec/foundation/curves/bn254"
import { sha512ToGrumpkinScalar } from "@aztec/foundation/crypto/sha512"
import { Schnorr } from "@aztec/foundation/crypto/schnorr"
import { type ContractArtifact, EventSelector, loadContractArtifact } from "@aztec/stdlib/abi"
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract"
import { deriveKeys } from "@aztec/stdlib/keys"
import type { ILogger } from "@/wallet/logger"
import { nuloV0PersistentArtifact as compiled } from "@nulo/contracts"
import { NuloV0Base } from "./azguard-v0-base"

const nuloV0PersistentArtifact = loadContractArtifact(compiled)

/**
 * Event selector for FunctionCallLog events emitted by the persistent account contract.
 * Used by the transaction indexer to query transaction history.
 */
export const FUNCTION_CALL_LOG_EVENT_SELECTOR = EventSelector.fromString("0x64658e88")

/**
 * Persistent Nulo account contract (with transaction history).
 * Emits FunctionCallLog events for each function call, enabling transaction history indexing.
 */
export class NuloV0Persistent extends NuloV0Base {
	public readonly name = "nulo-v0-persistent"
	protected readonly artifact: ContractArtifact = nuloV0PersistentArtifact

	public static async new(secret: Fr, logger: ILogger): Promise<NuloV0Persistent> {
		const keys = await deriveKeys(secret)
		const signingKey = sha512ToGrumpkinScalar([secret, 257])
		const signingPubKey = await new Schnorr().computePublicKey(signingKey)
		const instance = await getContractInstanceFromInstantiationParams(nuloV0PersistentArtifact, {
			constructorArgs: [signingPubKey.x, signingPubKey.y],
			publicKeys: keys.publicKeys,
			salt: Fr.zero(),
		})
		return new NuloV0Persistent(secret, signingKey, signingPubKey, instance, logger)
	}
}
