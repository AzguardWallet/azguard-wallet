// Contract artifact name is "AzguardAccount" (on-chain identity).
// TypeScript wrapper uses "Vibeguard" branding. Do not rename the JSON artifact.
import { Fr } from "@aztec/foundation/curves/bn254"
import { sha512ToGrumpkinScalar } from "@aztec/foundation/crypto/sha512"
import { Schnorr } from "@aztec/foundation/crypto/schnorr"
import { type ContractArtifact, loadContractArtifact } from "@aztec/stdlib/abi"
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract"
import { deriveKeys } from "@aztec/stdlib/keys"
import type { ILogger } from "@/wallet/logger"
import { vibeguardV0Artifact as compiled } from "@vibeguard/contracts"
import { VibeguardV0Base } from "./azguard-v0-base"

const vibeguardV0Artifact = loadContractArtifact(compiled)

/**
 * Standard Vibeguard account contract
 */
export class VibeguardV0 extends VibeguardV0Base {
	public readonly name = "vibeguard-v0"
	protected readonly artifact: ContractArtifact = vibeguardV0Artifact

	public static async new(secret: Fr, logger: ILogger): Promise<VibeguardV0> {
		const keys = await deriveKeys(secret)
		const signingKey = sha512ToGrumpkinScalar([secret, 257])
		const signingPubKey = await new Schnorr().computePublicKey(signingKey)
		const instance = await getContractInstanceFromInstantiationParams(vibeguardV0Artifact, {
			constructorArgs: [signingPubKey.x, signingPubKey.y],
			publicKeys: keys.publicKeys,
			salt: Fr.zero(),
		})
		return new VibeguardV0(secret, signingKey, signingPubKey, instance, logger)
	}
}
