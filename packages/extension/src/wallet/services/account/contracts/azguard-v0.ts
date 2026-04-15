// Contract artifact name is "AzguardAccount" (on-chain identity).
// TypeScript wrapper uses Nulo branding. Do not rename the JSON artifact.
import { Fr } from "@aztec/foundation/curves/bn254"
import { sha512ToGrumpkinScalar } from "@aztec/foundation/crypto/sha512"
import { Schnorr } from "@aztec/foundation/crypto/schnorr"
import { type ContractArtifact, loadContractArtifact } from "@aztec/stdlib/abi"
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract"
import { deriveKeys } from "@aztec/stdlib/keys"
import type { ILogger } from "@/wallet/logger"
import { nuloV0Artifact as compiled } from "@nulo/contracts"
import { NuloV0Base } from "./azguard-v0-base"

const nuloV0Artifact = loadContractArtifact(compiled)

/**
 * Standard Nulo account contract
 */
export class NuloV0 extends NuloV0Base {
	public readonly name = "nulo-v0"
	protected readonly artifact: ContractArtifact = nuloV0Artifact

	public static async new(secret: Fr, logger: ILogger): Promise<NuloV0> {
		const keys = await deriveKeys(secret)
		const signingKey = sha512ToGrumpkinScalar([secret, 257])
		const signingPubKey = await new Schnorr().computePublicKey(signingKey)
		const instance = await getContractInstanceFromInstantiationParams(nuloV0Artifact, {
			constructorArgs: [signingPubKey.x, signingPubKey.y],
			publicKeys: keys.publicKeys,
			salt: Fr.zero(),
		})
		return new NuloV0(secret, signingKey, signingPubKey, instance, logger)
	}
}
