import { DomainSeparator } from '@aztec/constants';
import { GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_DA_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_L2_GAS_LIMIT } from '@aztec/stdlib/gas';
import { Fr } from '@aztec/foundation/curves/bn254';
import { GrumpkinScalar } from '@aztec/foundation/curves/grumpkin';
import { poseidon2HashWithSeparator } from '@aztec/foundation/crypto/poseidon';
import { Schnorr } from '@aztec/foundation/crypto/schnorr';
import {
    ContractArtifact,
    encodeArguments,
    FunctionSelector,
} from '@aztec/stdlib/abi';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import {
    CompleteAddress,
    computePartialAddress,
    ContractInstanceWithAddress,
} from '@aztec/stdlib/contract';
import { Gas, GasFees, GasSettings } from '@aztec/stdlib/gas';
import { PublicKey } from '@aztec/stdlib/keys';
import {
    Capsule,
    HashedValues,
    TxContext,
    TxExecutionRequest,
} from '@aztec/stdlib/tx';
import { computeSiloedPrivateInitializationNullifier } from '@aztec/stdlib/hash';
import { AztecNode } from '@aztec/stdlib/interfaces/client';
import { ILogger, LogLevel } from '@/wallet/logger';
import type { IPXE } from "@/wallet/services/pxe/client";
import {
    getMulticallEntrypointAddress,
    getMulticallEntrypointFn,
    getMulticallEntrypointSelector,
} from '@/wallet/utils/multicall-entrypoint';
import { AzguardFeePaymentMethod, AzguardFunctionCall, IAccountContract } from '.';

const CHUNK_SIZE = 4;

// Max fee values for simulation - actual fees are set in ExecutionService.finalizeGasLimits
const MAX_FEE_PER_DA_GAS = BigInt(10 ** 18);
const MAX_FEE_PER_L2_GAS = BigInt(10 ** 18);

/**
 * Abstract base class for Azguard account contracts.
 * Provides shared implementation for both standard and persistent variants.
 */
export abstract class AzguardV0Base implements IAccountContract {
    public abstract readonly name: string;
    protected abstract readonly artifact: ContractArtifact;

    public readonly address: AztecAddress;

    constructor(
        protected readonly secret: Fr,
        protected readonly signingKey: GrumpkinScalar,
        protected readonly signingPubKey: PublicKey,
        protected readonly instance: ContractInstanceWithAddress,
        protected readonly logger: ILogger,
    ) {
        this.address = this.instance.address;
    }

    public async ensureRegistered(pxe: IPXE): Promise<void> {
        const accounts = await pxe.getRegisteredAccounts();
        if (!accounts.find(x => x.address.toString() === this.address.toString())) {
            this.logger.log(this.name, LogLevel.Debug, 'register account...');
            await pxe.registerAccount(this.secret, await computePartialAddress(this.instance));
        }
    }

    public async ensureContractRegistered(pxe: IPXE): Promise<void> {
        const instance = await pxe.getContractInstance(this.address);
        if (!instance) {
            this.logger.log(this.name, LogLevel.Debug, "register contract...");
            await pxe.registerContract({ instance: this.instance, artifact: this.artifact });
        }
    }

    public async getCompleteAddress(): Promise<CompleteAddress> {
        return await CompleteAddress.fromSecretKeyAndInstance(this.secret, this.instance);
    }

    public async buildAuthWitness(messageHash: Fr): Promise<AuthWitness> {
        const schnorr = new Schnorr();
        const signature = await schnorr.constructSignature(messageHash.toBuffer(), this.signingKey);
        return new AuthWitness(messageHash, [...signature.toBuffer()]);
    }

    public async buildTxExecutionRequest(
        node: AztecNode,
        pxe: IPXE,
        calls: AzguardFunctionCall[],
        nonce: Fr,
        feePaymentMethod: AzguardFeePaymentMethod,
        args: HashedValues[],
        authwits?: AuthWitness[],
        capsules?: Capsule[],
    ): Promise<TxExecutionRequest> {
        const fn = this.artifact.functions.find(x => x.name === "execute")!
        const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);

        let batchCalls = calls.slice();
        const batchArgs = args.slice();
        const batchAuthwits = authwits?.slice() ?? [];
        const batchCapsules = capsules?.slice() ?? [];

        while (batchCalls.length > CHUNK_SIZE) {
            let new_calls = [];
            while (Math.floor(batchCalls.length / CHUNK_SIZE) % CHUNK_SIZE + batchCalls.length % CHUNK_SIZE > CHUNK_SIZE) {
                batchCalls.push(AzguardFunctionCall.empty());
            }
            while (batchCalls.length >= CHUNK_SIZE) {
                const chunkCalls = batchCalls.splice(0, CHUNK_SIZE);
                const chunkNonce = Fr.random();
                const chunkFeePaymentMethod = AzguardFeePaymentMethod.External;
                const chunkArgs = await HashedValues.fromArgs(encodeArguments(fn, [chunkCalls, chunkNonce, chunkFeePaymentMethod]));
                batchArgs.push(chunkArgs);

                const chunkPayload = chunkCalls.flatMap(x => x.toFields()).concat(chunkNonce).concat(new Fr(chunkFeePaymentMethod));
                const chunkPayloadHash = await poseidon2HashWithSeparator(chunkPayload, DomainSeparator.SIGNATURE_PAYLOAD);
                const chunkAuthwit = await this.buildAuthWitness(chunkPayloadHash);
                batchAuthwits.push(chunkAuthwit);

                new_calls.push(new AzguardFunctionCall(this.address, fnSelector, chunkArgs.hash, false, false, false));
            }
            batchCalls = [...new_calls, ...batchCalls];
        }
        while (batchCalls.length < CHUNK_SIZE) {
            batchCalls.push(AzguardFunctionCall.empty());
        }

        const fnArgs = await HashedValues.fromArgs(encodeArguments(fn, [batchCalls, nonce, feePaymentMethod]));
        batchArgs.push(fnArgs);

        const payload = batchCalls.flatMap(x => x.toFields()).concat(nonce).concat(new Fr(feePaymentMethod));
        const payloadHash = await poseidon2HashWithSeparator(payload, DomainSeparator.SIGNATURE_PAYLOAD);
        const authwit = await this.buildAuthWitness(payloadHash);
        batchAuthwits.push(authwit);

        const { l1ChainId, rollupVersion } = await node.getNodeInfo();
        const gasSettings = new GasSettings(
            new Gas(GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT),
            new Gas(GAS_ESTIMATION_TEARDOWN_DA_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_L2_GAS_LIMIT),
            new GasFees(MAX_FEE_PER_DA_GAS, MAX_FEE_PER_L2_GAS),
            new GasFees(0, 0),
        )
        const txContext = new TxContext(l1ChainId, rollupVersion, gasSettings);

        const request = new TxExecutionRequest(this.address, fnSelector, fnArgs.hash, txContext, batchArgs, batchAuthwits, batchCapsules);

        // TODO: consider reusing ensureRegistered() / ensureContractRegistered() here
        const accounts = await pxe.getRegisteredAccounts();
        if (!accounts.find(x => x.address.toString() === this.address.toString())) {
            this.logger.log(this.name, LogLevel.Debug, 'register account...');
            await pxe.registerAccount(this.secret, await computePartialAddress(this.instance));
        }
        const contractInstance = await pxe.getContractInstance(this.address);
        if (!contractInstance) {
            this.logger.log(this.name, LogLevel.Debug, 'register contract...');
            await pxe.registerContract({instance: this.instance, artifact: this.artifact});
        }
        // Check if the contract is initialized on-chain via init nullifier
        const initNullifier = await computeSiloedPrivateInitializationNullifier(this.address, this.instance.initializationHash);
        this.logger.log(this.name, LogLevel.Debug, `checking init nullifier ${initNullifier.toString()} for ${this.address.toString()}`);
        const initWitness = await node.getNullifierMembershipWitness('latest', initNullifier);
        if (!initWitness) {
            this.logger.log(this.name, LogLevel.Debug, 'init nullifier NOT found, wrapping with initialization');
            return await this._withInitialization(request);
        }
        this.logger.log(this.name, LogLevel.Debug, 'init nullifier found, account already initialized');

        return request;
    }

    protected async _withInitialization(request: TxExecutionRequest): Promise<TxExecutionRequest> {
        const ctor = this.artifact.functions.find(x => x.name === "constructor")!;
        const ctorSelector = await FunctionSelector.fromNameAndParameters(ctor.name, ctor.parameters);
        const ctorPackedArgs = await HashedValues.fromArgs(encodeArguments(ctor, [this.signingPubKey.x, this.signingPubKey.y]));

        const mceCalls = [
            {
                args_hash: ctorPackedArgs.hash,
                function_selector: ctorSelector,
                target_address: request.origin,
                is_public: false,
                hide_msg_sender: false,
                is_static: false,
            },
            {
                args_hash: request.firstCallArgsHash,
                function_selector: request.functionSelector,
                target_address: request.origin,
                is_public: false,
                hide_msg_sender: false,
                is_static: false,
            },
            {
                args_hash: Fr.zero(),
                function_selector: FunctionSelector.empty(),
                target_address: AztecAddress.zero(),
                is_public: false,
                hide_msg_sender: false,
                is_static: false,
            },
            {
                args_hash: Fr.zero(),
                function_selector: FunctionSelector.empty(),
                target_address: AztecAddress.zero(),
                is_public: false,
                hide_msg_sender: false,
                is_static: false,
            },
            {
                args_hash: Fr.zero(),
                function_selector: FunctionSelector.empty(),
                target_address: AztecAddress.zero(),
                is_public: false,
                hide_msg_sender: false,
                is_static: false,
            },
        ];
        const mceArgs = await HashedValues.fromArgs(
            encodeArguments(getMulticallEntrypointFn(), [{ function_calls: mceCalls, tx_nonce: Fr.zero() }]),
        );

        return new TxExecutionRequest(
            getMulticallEntrypointAddress(),
            await getMulticallEntrypointSelector(),
            mceArgs.hash,
            request.txContext,
            [mceArgs, ctorPackedArgs, ...request.argsOfCalls],
            request.authWitnesses,
            request.capsules,
        );
    }
}

