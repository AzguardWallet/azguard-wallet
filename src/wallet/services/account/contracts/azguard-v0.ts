import { GeneratorIndex } from '@aztec/constants';
import {
    Fr,
    GrumpkinScalar,
} from '@aztec/foundation/fields';
import {
    poseidon2HashWithSeparator,
    sha512ToGrumpkinScalar,
    Schnorr,
} from '@aztec/foundation/crypto';
import {
    encodeArguments,
    FunctionSelector,
    loadContractArtifact,
} from '@aztec/stdlib/abi';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import {
    CompleteAddress,
    computePartialAddress,
    ContractInstanceWithAddress,
    getContractInstanceFromInstantiationParams,
} from '@aztec/stdlib/contract';
import { Gas, GasFees, GasSettings } from '@aztec/stdlib/gas';
import { PXE } from '@aztec/stdlib/interfaces/client';
import { 
    deriveKeys,
    PublicKey,
} from '@aztec/stdlib/keys';
import { NoirCompiledContract } from '@aztec/stdlib/noir';
import {
    Capsule,
    HashedValues,
    TxContext,
    TxExecutionRequest,
} from '@aztec/stdlib/tx';
import { ILogger, LogLevel } from '@/wallet/logger';
import {
    getMulticallEntrypointAddress,
    getMulticallEntrypointFn,
    getMulticallEntrypointSelector,
} from '@/wallet/utils/multicall-entrypoint';
import { AzguardFunctionCall, IAccountContract } from '.';

import compiled from './azguard-v0.json' with { type: "json" };
const azguardV0Artifact = loadContractArtifact(compiled as NoirCompiledContract);
const SETUP_CHUNK_SIZE = 2;
const CHUNK_SIZE = 4;

export class AzguardV0 implements IAccountContract {
    public readonly name = "azguard-v0";
    public readonly address: AztecAddress;
    
    constructor(
        private readonly secret: Fr,
        private readonly signingKey: GrumpkinScalar,
        private readonly signingPubKey: PublicKey,
        private readonly instance: ContractInstanceWithAddress,
        private readonly logger: ILogger,
    ) {
        this.address = this.instance.address;
    }

    public static async new(secret: Fr, logger: ILogger): Promise<AzguardV0> {
        const keys = await deriveKeys(secret);
        const signingKey = sha512ToGrumpkinScalar([secret, 257]);
        const signingPubKey = await new Schnorr().computePublicKey(signingKey);
        const instance = await getContractInstanceFromInstantiationParams(
            azguardV0Artifact,
            {
                constructorArgs: [signingPubKey.x, signingPubKey.y],
                publicKeys: keys.publicKeys,
                salt: Fr.zero(),
            }
        );
        return new AzguardV0(secret, signingKey, signingPubKey, instance, logger);
    }

    public async ensureRegistered(pxe: PXE): Promise<void> {
        const accounts = await pxe.getRegisteredAccounts();
        if (!accounts.find(x => x.address.toString() === this.address.toString())) {
            this.logger.log(this.name, LogLevel.Debug, 'register account...');
            await pxe.registerAccount(this.secret, await computePartialAddress(this.instance));
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

    public buildTxExecutionRequest(
        pxe: PXE,
        setup: AzguardFunctionCall[],
        isFeePayer: boolean,
        calls: AzguardFunctionCall[],
        args: HashedValues[],
        nonce: Fr,
        authwits?: AuthWitness[],
        capsules?: Capsule[],
    ): Promise<TxExecutionRequest> {
        return setup.length 
            ? this._buildTxExecutionRequestWithSetup(pxe, setup, isFeePayer, calls, args, nonce, authwits, capsules)
            : this._buildTxExecutionRequest(pxe, calls, args, nonce, authwits, capsules);
    }

    private async _buildTxExecutionRequest(
        pxe: PXE,
        calls: AzguardFunctionCall[],
        args: HashedValues[],
        nonce: Fr,
        authwits?: AuthWitness[],
        capsules?: Capsule[],
    ): Promise<TxExecutionRequest> {
        const fn = azguardV0Artifact.functions.find(x => x.name === "execute")!
        const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
        
        let batchCalls = calls.slice();
        const batchArgs = args.slice();
        const batchAuthwits = authwits ?? [];
        const batchCapsules = capsules ?? [];

        while (batchCalls.length > CHUNK_SIZE) {
            let new_calls = [];
            while (batchCalls.length >= CHUNK_SIZE) {
                const chunkCalls = batchCalls.splice(0, CHUNK_SIZE);
                const chunkNonce = nonce.isZero() ? Fr.zero() : Fr.random();
                const chunkArgs = await HashedValues.fromArgs(encodeArguments(fn, [chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);
                
                const chunkPayload = chunkCalls.flatMap(x => x.toFields()).concat(chunkNonce);
                const chunkPayloadHash = await poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = (await new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey)).toBuffer();
                const chunkAuthwit = new AuthWitness(chunkPayloadHash, [...chunkSignature]);
                batchAuthwits.push(chunkAuthwit);
                
                new_calls.push(new AzguardFunctionCall(this.address, fnSelector, chunkArgs.hash, false, false));
            }
            if (new_calls.length % CHUNK_SIZE + batchCalls.length > CHUNK_SIZE) {
                while (batchCalls.length < CHUNK_SIZE) {
                    batchCalls.push(AzguardFunctionCall.empty());
                }
                const chunkCalls = batchCalls;
                const chunkNonce = nonce.isZero() ? Fr.zero() : Fr.random();
                const chunkArgs = await HashedValues.fromArgs(encodeArguments(fn, [chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);

                const chunkPayload = chunkCalls.flatMap(x => x.toFields()).concat(chunkNonce);
                const chunkPayloadHash = await poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = (await new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey)).toBuffer();
                const chunkAuthwit = new AuthWitness(chunkPayloadHash, [...chunkSignature]);
                batchAuthwits.push(chunkAuthwit);

                new_calls.push(new AzguardFunctionCall(this.address, fnSelector, chunkArgs.hash, false, false));
            }
            else {
                new_calls.push(...batchCalls);
            }
            batchCalls = new_calls;
        }
        while (batchCalls.length < CHUNK_SIZE) {
            batchCalls.push(AzguardFunctionCall.empty());
        }

        const fnArgs = await HashedValues.fromArgs(encodeArguments(fn, [batchCalls, nonce]));
        batchArgs.push(fnArgs);

        const payload = batchCalls.flatMap(x => x.toFields()).concat(nonce);
        const payloadHash = await poseidon2HashWithSeparator(payload, GeneratorIndex.SIGNATURE_PAYLOAD);
        const signature = (await new Schnorr().constructSignature(payloadHash.toBuffer(), this.signingKey)).toBuffer();
        const authwit = new AuthWitness(payloadHash, [...signature]);
        batchAuthwits.push(authwit);

        const { l1ChainId, rollupVersion } = await pxe.getNodeInfo();
        const baseFees = await pxe.getCurrentBaseFees();
        const gasSettings = new GasSettings(
            new Gas(4_294_967_295, 4_294_967_295),
            new Gas(294_967_295, 294_967_295),
            baseFees,
            new GasFees(0, 0),
        )
        const txContext = new TxContext(l1ChainId, rollupVersion, gasSettings);

        const request = new TxExecutionRequest(this.address, fnSelector, fnArgs.hash, txContext, batchArgs, batchAuthwits, batchCapsules);
        
        const accounts = await pxe.getRegisteredAccounts();
        if (!accounts.find(x => x.address.toString() === this.address.toString())) {
            this.logger.log(this.name, LogLevel.Debug, 'register account...');
            await pxe.registerAccount(this.secret, await computePartialAddress(this.instance));
        }
        const contractMetadata = await pxe.getContractMetadata(this.address);
        if (!contractMetadata.contractInstance) {
            this.logger.log(this.name, LogLevel.Debug, 'register contract...');
            await pxe.registerContract({instance: this.instance, artifact: azguardV0Artifact});
        }
        if (!contractMetadata.isContractInitialized) {
            this.logger.log(this.name, LogLevel.Debug, 'initialize account contract instance...');
            return await this._withInitialization(request);
        }

        return request;
    }

    private async _buildTxExecutionRequestWithSetup(
        pxe: PXE,
        setup: AzguardFunctionCall[],
        isFeePayer: boolean,
        calls: AzguardFunctionCall[],
        args: HashedValues[],
        nonce: Fr,
        authwits?: AuthWitness[],
        capsules?: Capsule[],
    ): Promise<TxExecutionRequest> {
        const fn = azguardV0Artifact.functions.find(x => x.name === "execute_with_setup")!
        const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
        
        let setupCalls = setup.slice();
        let batchCalls = calls.slice();
        const batchArgs = args.slice();
        const batchAuthwits = authwits ?? [];
        const batchCapsules = capsules ?? [];

        if (setupCalls.length > SETUP_CHUNK_SIZE) {
            throw new Error("Unsuported number of setup calls");
        }
        while (batchCalls.length > CHUNK_SIZE) {
            let emptySetup = new Array(SETUP_CHUNK_SIZE).fill(AzguardFunctionCall.empty());
            let newCalls = [];
            while (batchCalls.length >= CHUNK_SIZE) {
                const chunkCalls = batchCalls.splice(0, CHUNK_SIZE);
                const chunkNonce = nonce.isZero() ? Fr.zero() : Fr.random();
                const chunkArgs = await HashedValues.fromArgs(encodeArguments(fn, [emptySetup, false, chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);
                
                const chunkPayload = emptySetup.flatMap(x => x.toFields())
                    .concat(chunkCalls.flatMap(x => x.toFields()))
                    .concat(chunkNonce);
                const chunkPayloadHash = await poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = (await new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey)).toBuffer();
                const chunkAuthwit = new AuthWitness(chunkPayloadHash, [...chunkSignature]);
                batchAuthwits.push(chunkAuthwit);
                
                newCalls.push(new AzguardFunctionCall(this.address, fnSelector, chunkArgs.hash, false, false));
            }
            if (newCalls.length % CHUNK_SIZE + batchCalls.length > CHUNK_SIZE) {
                while (batchCalls.length < CHUNK_SIZE) {
                    batchCalls.push(AzguardFunctionCall.empty());
                }
                const chunkCalls = batchCalls;
                const chunkNonce = nonce.isZero() ? Fr.zero() : Fr.random();
                const chunkArgs = await HashedValues.fromArgs(encodeArguments(fn, [emptySetup, false, chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);

                const chunkPayload = emptySetup.flatMap(x => x.toFields())
                    .concat(chunkCalls.flatMap(x => x.toFields()))
                    .concat(chunkNonce);
                const chunkPayloadHash = await poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = (await new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey)).toBuffer();
                const chunkAuthwit = new AuthWitness(chunkPayloadHash, [...chunkSignature]);
                batchAuthwits.push(chunkAuthwit);

                newCalls.push(new AzguardFunctionCall(this.address, fnSelector, chunkArgs.hash, false, false));
            }
            else {
                newCalls.push(...batchCalls);
            }
            batchCalls = newCalls;
        }

        while (setupCalls.length < SETUP_CHUNK_SIZE) {
            setupCalls.push(AzguardFunctionCall.empty());
        }
        while (batchCalls.length < CHUNK_SIZE) {
            batchCalls.push(AzguardFunctionCall.empty());
        }

        const fnArgs = await HashedValues.fromArgs(encodeArguments(fn, [setupCalls, isFeePayer, batchCalls, nonce]));
        batchArgs.push(fnArgs);

        const payload = setupCalls.flatMap(x => x.toFields())
            .concat(new Fr(isFeePayer))
            .concat(batchCalls.flatMap(x => x.toFields()))
            .concat(nonce);
        const payloadHash = await poseidon2HashWithSeparator(payload, GeneratorIndex.SIGNATURE_PAYLOAD);
        const signature = (await new Schnorr().constructSignature(payloadHash.toBuffer(), this.signingKey)).toBuffer();
        const authwit = new AuthWitness(payloadHash, [...signature]);
        batchAuthwits.push(authwit);

        const { l1ChainId, rollupVersion } = await pxe.getNodeInfo();
        const baseFees = await pxe.getCurrentBaseFees();
        const gasSettings = new GasSettings(
            new Gas(4_294_967_295, 4_294_967_295),
            new Gas(294_967_295, 294_967_295),
            baseFees,
            new GasFees(0, 0),
        )
        const txContext = new TxContext(l1ChainId, rollupVersion, gasSettings);

        const request = new TxExecutionRequest(this.address, fnSelector, fnArgs.hash, txContext, batchArgs, batchAuthwits, batchCapsules);
        
        const accounts = await pxe.getRegisteredAccounts();
        if (!accounts.find(x => x.address.toString() === this.address.toString())) {
            this.logger.log(this.name, LogLevel.Debug, 'register account...');
            await pxe.registerAccount(this.secret, await computePartialAddress(this.instance));
        }
        const contractMetadata = await pxe.getContractMetadata(this.address);
        if (!contractMetadata.contractInstance) {
            this.logger.log(this.name, LogLevel.Debug, 'register contract...');
            await pxe.registerContract({instance: this.instance, artifact: azguardV0Artifact});
        }
        if (!contractMetadata.isContractInitialized) {
            this.logger.log(this.name, LogLevel.Debug, 'initialize account contract instance...');
            return await this._withInitialization(request);
        }

        return request;
    }

    private async _withInitialization(request: TxExecutionRequest): Promise<TxExecutionRequest> {
        const ctor = azguardV0Artifact.functions.find(x => x.name === "constructor")!;
        const ctorSelector = await FunctionSelector.fromNameAndParameters(ctor.name, ctor.parameters);
        const ctorPackedArgs = await HashedValues.fromArgs(encodeArguments(ctor, [this.signingPubKey.x, this.signingPubKey.y]));

        const mceCalls = [
            {
                args_hash: ctorPackedArgs.hash,
                function_selector: ctorSelector,
                target_address: request.origin,
                is_public: false,
                is_static: false,
            },
            {
                args_hash: request.firstCallArgsHash,
                function_selector: request.functionSelector,
                target_address: request.origin,
                is_public: false,
                is_static: false,
            },
            {
                args_hash: Fr.zero(),
                function_selector: FunctionSelector.empty(),
                target_address: AztecAddress.zero(),
                is_public: false,
                is_static: false,
            },
            {
                args_hash: Fr.zero(),
                function_selector: FunctionSelector.empty(),
                target_address: AztecAddress.zero(),
                is_public: false,
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
