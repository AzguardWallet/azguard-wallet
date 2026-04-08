import type { ContractArtifact } from "@aztec/stdlib/abi"
import { Gas } from "@aztec/stdlib/gas"
import type { Action } from "@/wallet/services/execution/spec"
import type { FpcInfo } from "../spec"
import type { IFpcHandler } from "."

export class PrivateFpcHandler implements IFpcHandler {
	public async getAsset(): Promise<string | undefined> {
		return undefined
	}

	public acceptsPrivate(): boolean | undefined {
		return true
	}

	public acceptsPublic(): boolean | undefined {
		return undefined
	}

	public validateArtifact(artifact: ContractArtifact) {
		const payFee = artifact.functions.find((x) => x.name === "pay_fee")
		if (!payFee) {
			throw new Error("Function `pay_fee` not found")
		}
		if (payFee.parameters.length !== 0 || payFee.returnTypes.length !== 0) {
			throw new Error("Function `pay_fee` has unsupported signature")
		}

		const balanceOf = artifact.functions.find((x) => x.name === "balance_of")
		if (!balanceOf) {
			throw new Error("Function `balance_of` not found")
		}
	}

	public getFeePayload(fpc: FpcInfo): Action[] {
		return [
			{
				kind: "call",
				contract: fpc.address,
				method: "pay_fee",
				args: [],
			},
		]
	}

	public getTeardownGas(): Gas {
		return new Gas(0, 0)
	}

	public getTotalGas(): Gas {
		// PrivateFPC's pay_fee is heavy private execution — it walks encrypted notes
		// via recurse_subtract_balance_internal to debit wFJ. Bytecode is 16x larger
		// than SponsoredFPC. Empirically measured ~50k L2 gas overhead; pad generously
		// for note tree depth variation.
		return new Gas(50_000, 100_000)
	}
}
