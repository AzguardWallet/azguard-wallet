import { Barretenberg } from './index.js';
import { RawBuffer } from '../types/raw_buffer.js';
import { decompressSync as gunzip } from 'fflate';
import { deflattenFields, flattenFieldsAsArray, reconstructHonkProof, reconstructUltraPlonkProof, } from '../proof/index.js';
export class UltraPlonkBackend {
    constructor(acirBytecode, backendOptions = { threads: 1 }, circuitOptions = { recursive: false }) {
        this.backendOptions = backendOptions;
        this.circuitOptions = circuitOptions;
        this.acirUncompressedBytecode = acirToUint8Array(acirBytecode);
    }
    /** @ignore */
    async instantiate() {
        if (!this.api) {
            const api = await Barretenberg.new(this.backendOptions);
            const honkRecursion = false;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_total, subgroupSize] = await api.acirGetCircuitSizes(this.acirUncompressedBytecode, this.circuitOptions.recursive, honkRecursion);
            await api.initSRSForCircuitSize(subgroupSize);
            this.acirComposer = await api.acirNewAcirComposer(subgroupSize);
            await api.acirInitProvingKey(this.acirComposer, this.acirUncompressedBytecode, this.circuitOptions.recursive);
            this.api = api;
        }
    }
    /** @description Generates a proof */
    async generateProof(compressedWitness) {
        await this.instantiate();
        const proofWithPublicInputs = await this.api.acirCreateProof(this.acirComposer, this.acirUncompressedBytecode, this.circuitOptions.recursive, gunzip(compressedWitness));
        // This is the number of bytes in a UltraPlonk proof
        // minus the public inputs.
        const numBytesInProofWithoutPublicInputs = 2144;
        const splitIndex = proofWithPublicInputs.length - numBytesInProofWithoutPublicInputs;
        const publicInputsConcatenated = proofWithPublicInputs.slice(0, splitIndex);
        const proof = proofWithPublicInputs.slice(splitIndex);
        const publicInputs = deflattenFields(publicInputsConcatenated);
        return { proof, publicInputs };
    }
    /**
     * Generates artifacts that will be passed to a circuit that will verify this proof.
     *
     * Instead of passing the proof and verification key as a byte array, we pass them
     * as fields which makes it cheaper to verify in a circuit.
     *
     * The proof that is passed here will have been created by passing the `recursive`
     * parameter to a backend.
     *
     * The number of public inputs denotes how many public inputs are in the inner proof.
     *
     * @example
     * ```typescript
     * const artifacts = await backend.generateRecursiveProofArtifacts(proof, numOfPublicInputs);
     * ```
     */
    async generateRecursiveProofArtifacts(proofData, numOfPublicInputs = 0) {
        await this.instantiate();
        const proof = reconstructUltraPlonkProof(proofData);
        const proofAsFields = (await this.api.acirSerializeProofIntoFields(this.acirComposer, proof, numOfPublicInputs)).slice(numOfPublicInputs);
        // TODO: perhaps we should put this in the init function. Need to benchmark
        // TODO how long it takes.
        await this.api.acirInitVerificationKey(this.acirComposer);
        // Note: If you don't init verification key, `acirSerializeVerificationKeyIntoFields`` will just hang on serialization
        const vk = await this.api.acirSerializeVerificationKeyIntoFields(this.acirComposer);
        return {
            proofAsFields: proofAsFields.map(p => p.toString()),
            vkAsFields: vk[0].map(vk => vk.toString()),
            vkHash: vk[1].toString(),
        };
    }
    /** @description Verifies a proof */
    async verifyProof(proofData) {
        await this.instantiate();
        await this.api.acirInitVerificationKey(this.acirComposer);
        const proof = reconstructUltraPlonkProof(proofData);
        return await this.api.acirVerifyProof(this.acirComposer, proof);
    }
    /** @description Returns the verification key */
    async getVerificationKey() {
        await this.instantiate();
        await this.api.acirInitVerificationKey(this.acirComposer);
        return await this.api.acirGetVerificationKey(this.acirComposer);
    }
    /** @description Returns a solidity verifier */
    async getSolidityVerifier() {
        await this.instantiate();
        await this.api.acirInitVerificationKey(this.acirComposer);
        return await this.api.acirGetSolidityVerifier(this.acirComposer);
    }
    async destroy() {
        if (!this.api) {
            return;
        }
        await this.api.destroy();
    }
}
// Buffers are prepended with their size. The size takes 4 bytes.
const serializedBufferSize = 4;
const fieldByteSize = 32;
const publicInputOffset = 3;
const publicInputsOffsetBytes = publicInputOffset * fieldByteSize;
export class UltraHonkBackend {
    constructor(acirBytecode, backendOptions = { threads: 1 }, circuitOptions = { recursive: false }) {
        this.backendOptions = backendOptions;
        this.circuitOptions = circuitOptions;
        this.acirUncompressedBytecode = acirToUint8Array(acirBytecode);
    }
    /** @ignore */
    async instantiate() {
        if (!this.api) {
            const api = await Barretenberg.new(this.backendOptions);
            const honkRecursion = true;
            await api.acirInitSRS(this.acirUncompressedBytecode, this.circuitOptions.recursive, honkRecursion);
            // We don't init a proving key here in the Honk API
            // await api.acirInitProvingKey(this.acirComposer, this.acirUncompressedBytecode);
            this.api = api;
        }
    }
    async generateProof(compressedWitness, options) {
        await this.instantiate();
        const proveUltraHonk = options?.keccak
            ? this.api.acirProveUltraKeccakHonk.bind(this.api)
            : this.api.acirProveUltraHonk.bind(this.api);
        const proofWithPublicInputs = await proveUltraHonk(this.acirUncompressedBytecode, this.circuitOptions.recursive, gunzip(compressedWitness));
        const proofAsStrings = deflattenFields(proofWithPublicInputs.slice(4));
        const numPublicInputs = Number(proofAsStrings[1]);
        // Account for the serialized buffer size at start
        const publicInputsOffset = publicInputsOffsetBytes + serializedBufferSize;
        // Get the part before and after the public inputs
        const proofStart = proofWithPublicInputs.slice(0, publicInputsOffset);
        const publicInputsSplitIndex = numPublicInputs * fieldByteSize;
        const proofEnd = proofWithPublicInputs.slice(publicInputsOffset + publicInputsSplitIndex);
        // Construct the proof without the public inputs
        const proof = new Uint8Array([...proofStart, ...proofEnd]);
        // Fetch the number of public inputs out of the proof string
        const publicInputsConcatenated = proofWithPublicInputs.slice(publicInputsOffset, publicInputsOffset + publicInputsSplitIndex);
        const publicInputs = deflattenFields(publicInputsConcatenated);
        return { proof, publicInputs };
    }
    async verifyProof(proofData, options) {
        await this.instantiate();
        const proof = reconstructHonkProof(flattenFieldsAsArray(proofData.publicInputs), proofData.proof);
        const writeVkUltraHonk = options?.keccak
            ? this.api.acirWriteVkUltraKeccakHonk.bind(this.api)
            : this.api.acirWriteVkUltraHonk.bind(this.api);
        const verifyUltraHonk = options?.keccak
            ? this.api.acirVerifyUltraKeccakHonk.bind(this.api)
            : this.api.acirVerifyUltraHonk.bind(this.api);
        const vkBuf = await writeVkUltraHonk(this.acirUncompressedBytecode, this.circuitOptions.recursive);
        return await verifyUltraHonk(proof, new RawBuffer(vkBuf));
    }
    async getVerificationKey() {
        await this.instantiate();
        return await this.api.acirWriteVkUltraHonk(this.acirUncompressedBytecode, this.circuitOptions.recursive);
    }
    /** @description Returns a solidity verifier */
    async getSolidityVerifier(vk) {
        await this.instantiate();
        const vkBuf = vk ?? (await this.api.acirWriteVkUltraHonk(this.acirUncompressedBytecode, this.circuitOptions.recursive));
        return await this.api.acirHonkSolidityVerifier(this.acirUncompressedBytecode, vkBuf);
    }
    // TODO(https://github.com/noir-lang/noir/issues/5661): Update this to handle Honk recursive aggregation in the browser once it is ready in the backend itself
    async generateRecursiveProofArtifacts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _proof, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _numOfPublicInputs) {
        await this.instantiate();
        // TODO(https://github.com/noir-lang/noir/issues/5661): This needs to be updated to handle recursive aggregation.
        // There is still a proofAsFields method but we could consider getting rid of it as the proof itself
        // is a list of field elements.
        // UltraHonk also does not have public inputs directly prepended to the proof and they are still instead
        // inserted at an offset.
        // const proof = reconstructProofWithPublicInputs(proofData);
        // const proofAsFields = (await this.api.acirProofAsFieldsUltraHonk(proof)).slice(numOfPublicInputs);
        // TODO: perhaps we should put this in the init function. Need to benchmark
        // TODO how long it takes.
        const vkBuf = await this.api.acirWriteVkUltraHonk(this.acirUncompressedBytecode, this.circuitOptions.recursive);
        const vk = await this.api.acirVkAsFieldsUltraHonk(vkBuf);
        return {
            // TODO(https://github.com/noir-lang/noir/issues/5661)
            proofAsFields: [],
            vkAsFields: vk.map(vk => vk.toString()),
            // We use an empty string for the vk hash here as it is unneeded as part of the recursive artifacts
            // The user can be expected to hash the vk inside their circuit to check whether the vk is the circuit
            // they expect
            vkHash: '',
        };
    }
    async destroy() {
        if (!this.api) {
            return;
        }
        await this.api.destroy();
    }
}
export class AztecClientBackend {
    constructor(acirMsgpack, options = { threads: 1 }) {
        this.acirMsgpack = acirMsgpack;
        this.options = options;
    }
    /** @ignore */
    async instantiate() {
        if (!this.api) {
            const api = await Barretenberg.new(this.options);
            await api.initSRSClientIVC();
            this.api = api;
        }
    }
    async prove(witnessMsgpack) {
        await this.instantiate();
        return this.api.acirProveAztecClient(this.acirMsgpack, witnessMsgpack);
    }
    async verify(proof, vk) {
        await this.instantiate();
        return this.api.acirVerifyAztecClient(proof, vk);
    }
    async proveAndVerify(witnessMsgpack) {
        await this.instantiate();
        return this.api.acirProveAndVerifyAztecClient(this.acirMsgpack, witnessMsgpack);
    }
    async destroy() {
        if (!this.api) {
            return;
        }
        await this.api.destroy();
    }
}
// Converts bytecode from a base64 string to a Uint8Array
function acirToUint8Array(base64EncodedBytecode) {
    const compressedByteCode = base64Decode(base64EncodedBytecode);
    return gunzip(compressedByteCode);
}
// Since this is a simple function, we can use feature detection to
// see if we are in the nodeJs environment or the browser environment.
function base64Decode(input) {
    if (typeof Buffer !== 'undefined') {
        // Node.js environment
        const b = Buffer.from(input, 'base64');
        return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    }
    else if (typeof atob === 'function') {
        // Browser environment
        return Uint8Array.from(atob(input), c => c.charCodeAt(0));
    }
    else {
        throw new Error('No implementation found for base64 decoding.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmcvYmFja2VuZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQWtCLFlBQVksRUFBa0IsTUFBTSxZQUFZLENBQUM7QUFDMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ25ELE9BQU8sRUFBRSxjQUFjLElBQUksTUFBTSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ2xELE9BQU8sRUFDTCxlQUFlLEVBQ2Ysb0JBQW9CLEVBRXBCLG9CQUFvQixFQUNwQiwwQkFBMEIsR0FDM0IsTUFBTSxtQkFBbUIsQ0FBQztBQUUzQixNQUFNLE9BQU8saUJBQWlCO0lBWTVCLFlBQ0UsWUFBb0IsRUFDVixpQkFBaUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQy9DLGlCQUFpQyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7UUFEckQsbUJBQWMsR0FBZCxjQUFjLENBQWlDO1FBQy9DLG1CQUFjLEdBQWQsY0FBYyxDQUF1QztRQUUvRCxJQUFJLENBQUMsd0JBQXdCLEdBQUcsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVELGNBQWM7SUFDZCxLQUFLLENBQUMsV0FBVztRQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDZCxNQUFNLEdBQUcsR0FBRyxNQUFNLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRXhELE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQztZQUM1Qiw2REFBNkQ7WUFDN0QsTUFBTSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxtQkFBbUIsQ0FDMUQsSUFBSSxDQUFDLHdCQUF3QixFQUM3QixJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFDN0IsYUFBYSxDQUNkLENBQUM7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