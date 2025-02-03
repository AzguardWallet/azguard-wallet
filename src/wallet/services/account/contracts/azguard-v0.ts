import {
    AuthWitness,
    AztecAddress,
    deriveKeys,
    encodeArguments,
    Fr,
    FunctionSelector,
    getContractInstanceFromDeployParams,
    GrumpkinScalar,
    loadContractArtifact,
    NoirCompiledContract,
    PackedValues,
    PublicKey,
    PXE,
    Schnorr,
    TxExecutionRequest
} from '@aztec/aztec.js';
import {
    computePartialAddress,
    ContractInstanceWithAddress,
    GasFees,
    GasSettings,
    GeneratorIndex,
    TxContext,
} from '@aztec/circuits.js';
import {
    poseidon2HashWithSeparator,
    sha512ToGrumpkinScalar,
} from '@aztec/foundation/crypto';
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
    public readonly address: AztecAddress;
    
    private readonly secret: Fr;
    private readonly instance: ContractInstanceWithAddress;
    private readonly signingKey: GrumpkinScalar;
    private readonly signingPubKey: PublicKey;

    constructor(secret: Fr) {
        this.secret = secret;
        const keys = deriveKeys(secret);
        this.signingKey = this.deriveSigningKey(secret);
        this.signingPubKey = new Schnorr().computePublicKey(this.signingKey);
        this.instance = getContractInstanceFromDeployParams(
            azguardV0Artifact,
            {
                constructorArgs: [this.signingPubKey.x, this.signingPubKey.y],
                publicKeys: keys.publicKeys,
                salt: Fr.zero(),
            }
        );
        this.address = this.instance.address;
    }

    public signPayload(payload: Uint8Array): string {
        return new Schnorr().constructSignature(payload, this.signingKey).toString();
    }

    public buildAuthWitness(messageHash: Fr): Promise<AuthWitness> {
        const schnorr = new Schnorr();
        const signature = schnorr.constructSignature(messageHash.toBuffer(), this.signingKey).toBuffer();
        return Promise.resolve(new AuthWitness(messageHash, [...signature]));
    }

    public buildTxExecutionRequest(pxe: PXE, setup: AzguardFunctionCall[], calls: AzguardFunctionCall[], args: PackedValues[], nonce: Fr): Promise<TxExecutionRequest> {
        // if (!setup.length) {
        //     return this._buildTxExecutionRequest(pxe, calls, args, nonce);
        // }
        return this._buildTxExecutionRequestWithSetup(pxe, setup, calls, args, nonce);
    }

    private async _buildTxExecutionRequest(pxe: PXE, calls: AzguardFunctionCall[], args: PackedValues[], nonce: Fr): Promise<TxExecutionRequest> {
        const fn = azguardV0Artifact.functions.find(x => x.name === "execute")!
        const fnSelector = FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
        
        let batchCalls = calls.slice();
        const batchArgs = args.slice();
        const batchAuthwits = [];

        while (batchCalls.length > CHUNK_SIZE) {
            let new_calls = [];
            while (batchCalls.length >= CHUNK_SIZE) {
                const chunkCalls = batchCalls.splice(0, CHUNK_SIZE);
                const chunkNonce = nonce.isZero() ? Fr.zero() : Fr.random();
                const chunkArgs = PackedValues.fromValues(encodeArguments(fn, [chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);
                
                const chunkPayload = chunkCalls.flatMap(x => x.toFields()).concat(chunkNonce);
                const chunkPayloadHash = poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey).toBuffer();
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
                const chunkArgs = PackedValues.fromValues(encodeArguments(fn, [chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);

                const chunkPayload = chunkCalls.flatMap(x => x.toFields()).concat(chunkNonce);
                const chunkPayloadHash = poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey).toBuffer();
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

        const fnArgs = PackedValues.fromValues(encodeArguments(fn, [batchCalls, nonce]));
        batchArgs.push(fnArgs);

        const payload = batchCalls.flatMap(x => x.toFields()).concat(nonce);
        const payloadHash = poseidon2HashWithSeparator(payload, GeneratorIndex.SIGNATURE_PAYLOAD);
        const signature = new Schnorr().constructSignature(payloadHash.toBuffer(), this.signingKey).toBuffer();
        const authwit = new AuthWitness(payloadHash, [...signature]);
        batchAuthwits.push(authwit);

        const nodeInfo = await pxe.getNodeInfo();
        const gasSettings = GasSettings.default({maxFeesPerGas: new GasFees(10, 10)});
        const txContext = new TxContext(nodeInfo.l1ChainId, nodeInfo.protocolVersion, gasSettings);

        const request = new TxExecutionRequest(this.address, fnSelector, fnArgs.hash, txContext, batchArgs, batchAuthwits);
        
        console.debug('registering account...');
        await pxe.registerAccount(this.secret, computePartialAddress(this.instance));
        console.debug('registering contract...');
        await pxe.registerContract({instance: this.instance, artifact: azguardV0Artifact});

        if (!await pxe.isContractInitialized(this.address)) {
            console.debug('initialize account contract instance...');
            return this._withInitialization(request);
        }

        return request;
    }

    private async _buildTxExecutionRequestWithSetup(pxe: PXE, setup: AzguardFunctionCall[], calls: AzguardFunctionCall[], args: PackedValues[], nonce: Fr): Promise<TxExecutionRequest> {
        const fn = azguardV0Artifact.functions.find(x => x.name === "execute_with_setup")!
        const fnSelector = FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
        
        let setupCalls = setup.slice();
        let batchCalls = calls.slice();
        const batchArgs = args.slice();
        const batchAuthwits = [];

        if (setupCalls.length > SETUP_CHUNK_SIZE) {
            throw new Error("Unsuported number of setup calls");
        }
        while (batchCalls.length > CHUNK_SIZE) {
            let emptySetup = new Array(SETUP_CHUNK_SIZE).fill(AzguardFunctionCall.empty());
            let newCalls = [];
            while (batchCalls.length >= CHUNK_SIZE) {
                const chunkCalls = batchCalls.splice(0, CHUNK_SIZE);
                const chunkNonce = nonce.isZero() ? Fr.zero() : Fr.random();
                const chunkArgs = PackedValues.fromValues(encodeArguments(fn, [emptySetup, chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);
                
                const chunkPayload = emptySetup.flatMap(x => x.toFields())
                    .concat(chunkCalls.flatMap(x => x.toFields()))
                    .concat(chunkNonce);
                const chunkPayloadHash = poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey).toBuffer();
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
                const chunkArgs = PackedValues.fromValues(encodeArguments(fn, [emptySetup, chunkCalls, chunkNonce]));
                batchArgs.push(chunkArgs);

                const chunkPayload = emptySetup.flatMap(x => x.toFields())
                    .concat(chunkCalls.flatMap(x => x.toFields()))
                    .concat(chunkNonce);
                const chunkPayloadHash = poseidon2HashWithSeparator(chunkPayload, GeneratorIndex.SIGNATURE_PAYLOAD);
                const chunkSignature = new Schnorr().constructSignature(chunkPayloadHash.toBuffer(), this.signingKey).toBuffer();
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

        const fnArgs = PackedValues.fromValues(encodeArguments(fn, [setupCalls, batchCalls, nonce]));
        batchArgs.push(fnArgs);

        const payload = setupCalls.flatMap(x => x.toFields())
            .concat(batchCalls.flatMap(x => x.toFields()))
            .concat(nonce);
        const payloadHash = poseidon2HashWithSeparator(payload, GeneratorIndex.SIGNATURE_PAYLOAD);
        const signature = new Schnorr().constructSignature(payloadHash.toBuffer(), this.signingKey).toBuffer();
        const authwit = new AuthWitness(payloadHash, [...signature]);
        batchAuthwits.push(authwit);

        const nodeInfo = await pxe.getNodeInfo();
        const gasSettings = GasSettings.default({maxFeesPerGas: new GasFees(10, 10)});
        const txContext = new TxContext(nodeInfo.l1ChainId, nodeInfo.protocolVersion, gasSettings);

        const request = new TxExecutionRequest(this.address, fnSelector, fnArgs.hash, txContext, batchArgs, batchAuthwits);
        
        console.debug('registering account...');
        await pxe.registerAccount(this.secret, computePartialAddress(this.instance));
        console.debug('registering contract...');
        await pxe.registerContract({instance: this.instance, artifact: azguardV0Artifact});

        if (!await pxe.isContractInitialized(this.address)) {
            console.debug('initialize account contract instance...');
            return this._withInitialization(request);
        }

        return request;
    }

    private _withInitialization(request: TxExecutionRequest): TxExecutionRequest {
        const ctor = azguardV0Artifact.functions.find(x => x.name === "constructor")!;
        const ctorSelector = FunctionSelector.fromNameAndParameters(ctor.name, ctor.parameters);
        const ctorPackedArgs = PackedValues.fromValues(encodeArguments(ctor, [this.signingPubKey.x, this.signingPubKey.y]));

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
        const mceArgs = PackedValues.fromValues(
            encodeArguments(getMulticallEntrypointFn(), [{ function_calls: mceCalls, nonce: Fr.zero() }]),
        );

        return new TxExecutionRequest(
            getMulticallEntrypointAddress(),
            getMulticallEntrypointSelector(),
            mceArgs.hash,
            request.txContext,
            [mceArgs, ctorPackedArgs, ...request.argsOfCalls],
            request.authWitnesses,
        );
    }

    private deriveSigningKey(secret: Fr): GrumpkinScalar {
        return sha512ToGrumpkinScalar([secret, 257]);
    }
}