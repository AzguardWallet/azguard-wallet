/**
 * Thin adapter over upstream @aztec/accounts/schnorr.
 * Keeps our IAccountContract surface (for DI + cross-process PXE) while delegating
 * payload encoding, signing, and entrypoint semantics to the canonical Aztec SDK.
 */
import { Fr } from "@aztec/foundation/curves/bn254"
import { FunctionSelector, type ContractArtifact } from "@aztec/stdlib/abi"
import { FunctionCall } from "@aztec/stdlib/abi"
import type { AztecAddress } from "@aztec/stdlib/aztec-address"
import type { AuthWitness } from "@aztec/stdlib/auth-witness"
import {
	CompleteAddress,
	computePartialAddress,
	type ContractInstanceWithAddress,
	getContractInstanceFromInstantiationParams,
} from "@aztec/stdlib/contract"
import {
	GAS_ESTIMATION_DA_GAS_LIMIT,
	GAS_ESTIMATION_L2_GAS_LIMIT,
	GAS_ESTIMATION_TEARDOWN_DA_GAS_LIMIT,
	GAS_ESTIMATION_TEARDOWN_L2_GAS_LIMIT,
	Gas,
	GasFees,
	GasSettings,
} from "@aztec/stdlib/gas"
import { computeSiloedPrivateInitializationNullifier } from "@aztec/stdlib/hash"
import type { AztecNode } from "@aztec/stdlib/interfaces/client"
import { deriveKeys, deriveSigningKey } from "@aztec/stdlib/keys"
import { ExecutionPayload, type TxExecutionRequest } from "@aztec/stdlib/tx"
import { SchnorrAccountContract, SchnorrAccountContractArtifact } from "@aztec/accounts/schnorr"
import { AccountFeePaymentMethodOptions, DefaultAccountEntrypoint, type DefaultAccountEntrypointOptions } from "@aztec/entrypoints/account"
import { DefaultMultiCallEntrypoint } from "@aztec/entrypoints/multicall"
import { APP_MAX_CALLS } from "@aztec/entrypoints/encoding"
import type { ChainInfo } from "@aztec/entrypoints/interfaces"
import type { AuthWitnessProvider } from "@aztec/entrypoints/interfaces"
import { LogLevel, type ILogger } from "@/wallet/logger"
import type { IPXE } from "@/wallet/services/pxe/client"
import type { IAccountContract } from "."

const MAX_FEE_PER_DA_GAS = BigInt(10 ** 18)
const MAX_FEE_PER_L2_GAS = BigInt(10 ** 18)

export class NuloAccount implements IAccountContract {
	public readonly name = "nulo-v1"
	public readonly address: AztecAddress
	public readonly artifact: ContractArtifact = SchnorrAccountContractArtifact

	private readonly entrypoint: DefaultAccountEntrypoint
	private readonly authWitnessProvider: AuthWitnessProvider

	constructor(
		private readonly secret: Fr,
		private readonly instance: ContractInstanceWithAddress,
		private readonly completeAddress: CompleteAddress,
		signingAccountContract: SchnorrAccountContract,
		private readonly logger: ILogger,
	) {
		this.address = instance.address
		this.authWitnessProvider = signingAccountContract.getAuthWitnessProvider(completeAddress)
		this.entrypoint = new DefaultAccountEntrypoint(this.address, this.authWitnessProvider)
	}

	public static async new(secret: Fr, logger: ILogger): Promise<NuloAccount> {
		const signingKey = deriveSigningKey(secret)
		const keys = await deriveKeys(secret)
		const accountContract = new SchnorrAccountContract(signingKey)
		const { constructorName, constructorArgs } = await accountContract.getInitializationFunctionAndArgs()
		const instance = await getContractInstanceFromInstantiationParams(SchnorrAccountContractArtifact, {
			constructorArgs,
			constructorArtifact: constructorName,
			publicKeys: keys.publicKeys,
			salt: Fr.ZERO,
		})
		const completeAddress = await CompleteAddress.fromSecretKeyAndInstance(secret, instance)
		return new NuloAccount(secret, instance, completeAddress, accountContract, logger)
	}

	public async ensureRegistered(pxe: IPXE): Promise<void> {
		const accounts = await pxe.getRegisteredAccounts()
		if (!accounts.find((x) => x.address.toString() === this.address.toString())) {
			this.logger.log(this.name, LogLevel.Debug, "register account...")
			await pxe.registerAccount(this.secret, await computePartialAddress(this.instance))
		}
	}

	public async ensureContractRegistered(pxe: IPXE): Promise<void> {
		const instance = await pxe.getContractInstance(this.address)
		if (!instance) {
			this.logger.log(this.name, LogLevel.Debug, "register contract...")
			await pxe.registerContract({ instance: this.instance, artifact: this.artifact })
		}
	}

	public async getCompleteAddress(): Promise<CompleteAddress> {
		return this.completeAddress
	}

	public async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
		return this.authWitnessProvider.createAuthWit(messageHash)
	}

	public async buildTxExecutionRequest(
		node: AztecNode,
		pxe: IPXE,
		payload: ExecutionPayload,
		options: DefaultAccountEntrypointOptions,
	): Promise<TxExecutionRequest> {
		const { l1ChainId, rollupVersion } = await node.getNodeInfo()
		const chainInfo: ChainInfo = {
			chainId: new Fr(l1ChainId),
			version: new Fr(rollupVersion),
		}
		const gasSettings = new GasSettings(
			new Gas(GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT),
			new Gas(GAS_ESTIMATION_TEARDOWN_DA_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_L2_GAS_LIMIT),
			new GasFees(MAX_FEE_PER_DA_GAS, MAX_FEE_PER_L2_GAS),
			new GasFees(0, 0),
		)

		// Recursively chunk payloads exceeding APP_MAX_CALLS by wrapping slices through
		// the account entrypoint, so every nesting layer gets its own outer-authwit hash.
		let current = payload
		while (current.calls.length > APP_MAX_CALLS) {
			current = await this.chunkHead(current, chainInfo)
		}

		await this.ensureRegistered(pxe)
		await this.ensureContractRegistered(pxe)

		const initNullifier = await computeSiloedPrivateInitializationNullifier(this.address, this.instance.initializationHash)
		const initWitness = await node.getNullifierMembershipWitness("latest", initNullifier)
		if (!initWitness) {
			this.logger.log(this.name, LogLevel.Debug, "init nullifier NOT found, wrapping deploy + entrypoint via MulticallEntrypoint")
			return this.buildWithInitialization(current, chainInfo, gasSettings, options)
		}

		return this.entrypoint.createTxExecutionRequest(current, gasSettings, chainInfo, options)
	}

	/**
	 * Take the first APP_MAX_CALLS calls, wrap them via the account entrypoint (each wrap signs
	 * its own outer-authwit), and keep the remainder. Loop at call-site until `calls.length <= APP_MAX_CALLS`.
	 */
	private async chunkHead(payload: ExecutionPayload, chainInfo: ChainInfo): Promise<ExecutionPayload> {
		const head = payload.calls.slice(0, APP_MAX_CALLS)
		const tail = payload.calls.slice(APP_MAX_CALLS)
		const chunkOptions: DefaultAccountEntrypointOptions = {
			cancellable: false,
			txNonce: Fr.random(),
			feePaymentMethodOptions: AccountFeePaymentMethodOptions.EXTERNAL,
		}
		const wrapped = await this.entrypoint.wrapExecutionPayload(new ExecutionPayload(head, [], [], []), chainInfo, chunkOptions)
		return new ExecutionPayload(
			[...wrapped.calls, ...tail],
			[...payload.authWitnesses, ...wrapped.authWitnesses],
			[...payload.capsules, ...wrapped.capsules],
			[...payload.extraHashedArgs, ...wrapped.extraHashedArgs],
		)
	}

	/**
	 * First-tx deploy path: wrap [ctor, ...userPayload] via the protocol MulticallEntrypoint so the
	 * tx simultaneously publishes the account and executes the user's first call.
	 */
	private async buildWithInitialization(
		payload: ExecutionPayload,
		chainInfo: ChainInfo,
		gasSettings: GasSettings,
		options: DefaultAccountEntrypointOptions,
	): Promise<TxExecutionRequest> {
		const wrappedApp = await this.entrypoint.wrapExecutionPayload(payload, chainInfo, options)

		const ctorFn =
			this.artifact.functions.find((x) => x.name === "constructor") ??
			this.artifact.functions.find((x) => x.name.includes("constructor"))
		if (!ctorFn) {
			throw new Error("constructor not found in account artifact")
		}
		const ctorSelector = await FunctionSelector.fromNameAndParameters(ctorFn.name, ctorFn.parameters)
		const schnorr = new SchnorrAccountContract(deriveSigningKey(this.secret))
		const { constructorArgs } = await schnorr.getInitializationFunctionAndArgs()

		const ctorCall = new FunctionCall(
			ctorFn.name,
			this.address,
			ctorSelector,
			ctorFn.functionType,
			false,
			ctorFn.isStatic,
			constructorArgs,
			ctorFn.returnTypes,
		)

		const combined = new ExecutionPayload(
			[ctorCall, ...wrappedApp.calls],
			wrappedApp.authWitnesses,
			wrappedApp.capsules,
			wrappedApp.extraHashedArgs,
		)

		const multicall = new DefaultMultiCallEntrypoint()
		return multicall.createTxExecutionRequest(combined, gasSettings, chainInfo)
	}
}
