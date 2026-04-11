import type { Fr } from "@aztec/foundation/curves/bn254"
import type { ContractArtifact } from "@aztec/stdlib/abi"
import type { Gas } from "@aztec/stdlib/gas"
import type { Action } from "@/wallet/services/execution/spec"
import type { IPXE } from "@/wallet/services/pxe/proxy"
import { type FpcInfo, FpcType } from "../spec"
import { DefaultFpcHandler } from "./default-fpc-handler"
import { DefaultSponsoredFpcHandler } from "./default-sponsored-fpc-handler"
import { PrivateFpcHandler } from "./private-fpc-handler"
import type { AztecNode } from "@aztec/stdlib/interfaces/client"

export interface IFpcHandler {
	getAsset(fpcAddress: string, pxe: IPXE, node: AztecNode): Promise<string | undefined>
	acceptsPublic(): boolean | undefined
	acceptsPrivate(): boolean | undefined
	validateArtifact(artifact: ContractArtifact): void
	getFeePayload(fpc: FpcInfo, account: string, maxFee: Fr, inPublic?: boolean): Action[]
	getTeardownGas(inPublic?: boolean): Gas
	getTotalGas(inPublic?: boolean): Gas
}

export function getFpcHandler(type: FpcType) {
	switch (type) {
		case FpcType.DefaultFpc: {
			return new DefaultFpcHandler()
		}
		case FpcType.DefaultSponsoredFpc: {
			return new DefaultSponsoredFpcHandler()
		}
		case FpcType.PrivateFpc: {
			return new PrivateFpcHandler()
		}
		default: {
			throw new Error("Invalid FPC type")
		}
	}
}
