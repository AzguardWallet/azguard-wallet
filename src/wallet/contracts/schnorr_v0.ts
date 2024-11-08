import {
	AztecAddress,
	deriveKeys,
	Fr,
	getContractInstanceFromDeployParams,
	GrumpkinScalar,
} from "@aztec/aztec.js"
import { sha512ToGrumpkinScalar } from "@aztec/foundation/crypto"
import { SchnorrAccountContract } from "@aztec/accounts/schnorr"
import { IAccountContract, INetwork, IProfile } from "../abstract"

export class SchnorrAccountContractV0 implements IAccountContract {
	constructor(
		private readonly profile: IProfile,
		private readonly network: INetwork,
		private readonly account: number
	) {}

	public async getAddress(): Promise<AztecAddress> {
		const secret = await this.profile.deriveChildSecret(
			this.network.chainId,
			this.account
		)
		const contract = new SchnorrAccountContract(
			this._deriveSigningKey(secret)
		)
		const instance = getContractInstanceFromDeployParams(
			contract.getContractArtifact(),
			{
				constructorArgs: contract.getDeploymentArgs(),
				publicKeys: deriveKeys(secret).publicKeys,
				salt: Fr.zero(),
			}
		)
		return instance.address
	}

	private _deriveSigningKey(secret: Fr): GrumpkinScalar {
		return sha512ToGrumpkinScalar([secret, 257])
	}
}
