import { Fr } from "@aztec/foundation/curves/bn254"
import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { HashedValues, type NestedProcessReturnValues } from "@aztec/stdlib/tx"
import { type AbiType, encodeArguments, type FunctionAbi, FunctionCall, FunctionSelector, FunctionType } from "@aztec/stdlib/abi"
import { NuloFeePaymentMethod, NuloFunctionCall, type IAccountContract } from "@/wallet/services/account/contracts"
import type { AztecNode } from "@aztec/stdlib/interfaces/client"
import type { IPXE } from "@/wallet/services/pxe/proxy"

export class FnImpl {
	constructor(
		public readonly name: string,
		public readonly impl: number,
	) {}
}

export abstract class Fn extends FnImpl {
	public readonly isStatic: boolean
	public readonly type: FunctionType

	constructor(name: string, impl: number) {
		super(name, impl)

		const abi = this.abi()
		this.isStatic = abi.isStatic
		this.type = abi.functionType
	}

	protected abstract abi(): FunctionAbi

	public abstract buildArgs(...args: unknown[]): unknown[]

	public async getSelector(): Promise<FunctionSelector> {
		const abi = this.abi()
		return await FunctionSelector.fromNameAndParameters(abi.name, abi.parameters)
	}

	public encodeArgs(args: unknown[]): Fr[] {
		return encodeArguments(this.abi(), args)
	}

	public getReturnTypes(): AbiType[] {
		return this.abi().returnTypes
	}

	public getImpl(): FnImpl {
		return new FnImpl(this.name, this.impl)
	}
}

export abstract class ViewFn extends Fn {
	public abstract unpackResult(values: Fr[]): unknown
}

export async function simulate(
	node: AztecNode,
	pxe: IPXE,
	account: IAccountContract,
	contract: string,
	viewFn: ViewFn,
	args: unknown[],
): Promise<unknown> {
	const contractAddress = AztecAddress.fromString(contract)
	const fnSelector = await viewFn.getSelector()
	const encodedArgs = viewFn.encodeArgs(args)

	if (viewFn.type === FunctionType.UTILITY) {
		const call = new FunctionCall(
			viewFn.name,
			contractAddress,
			fnSelector,
			viewFn.type,
			false,
			viewFn.isStatic,
			encodedArgs,
			viewFn.getReturnTypes(),
		)
		const { result } = await pxe.executeUtility(call, { scopes: [account.address] })
		return viewFn.unpackResult(result)
	}

	const packedArgs =
		viewFn.type === FunctionType.PUBLIC
			? await HashedValues.fromCalldata([fnSelector.toField(), ...encodedArgs])
			: await HashedValues.fromArgs(encodedArgs)

	const call = new NuloFunctionCall(
		contractAddress,
		fnSelector,
		packedArgs.hash,
		viewFn.type === FunctionType.PUBLIC,
		viewFn.isStatic,
		false,
	)

	const txRequest = await account.buildTxExecutionRequest(node, pxe, [call], Fr.random(), NuloFeePaymentMethod.FeeJuice, [packedArgs])

	const tx = await pxe.simulateTx(txRequest, {
		simulatePublic: true,
		skipFeeEnforcement: true,
		scopes: [account.address],
	})

	return viewFn.type === FunctionType.PUBLIC
		? viewFn.unpackResult(extractReturnValues(tx.getPublicReturnValues()))
		: viewFn.unpackResult(extractReturnValues([tx.getPrivateReturnValues()]))
}

function extractReturnValues(values: NestedProcessReturnValues[]): Fr[] {
	const res = []
	for (const v of values) {
		for (const value of v.values ?? []) {
			res.push(value)
		}
		res.push(...extractReturnValues(v.nested))
	}
	return res
}
