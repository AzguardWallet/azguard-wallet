#!/usr/bin/env node
import { Crs, GrumpkinCrs, Barretenberg, RawBuffer } from './index.js';
import createDebug from 'debug';
import { readFileSync, writeFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { ungzip } from 'pako';
import { Command } from 'commander';
import { decode } from '@msgpack/msgpack';
import { Timer, writeBenchmark } from './benchmark/index.js';
import path from 'path';
createDebug.log = console.error.bind(console);
const debug = createDebug('bb.js');
// Maximum circuit size for plonk we support in node and the browser is 2^19.
// This is because both node and browser use barretenberg.wasm which has a 4GB memory limit.
//
// This is not a restriction in the bb binary and one should be
// aware of this discrepancy, when creating proofs in bb versus
// creating the same proofs in the node CLI.
const MAX_ULTRAPLONK_CIRCUIT_SIZE_IN_WASM = 2 ** 19;
const threads = +process.env.HARDWARE_CONCURRENCY || undefined;
function getBytecode(bytecodePath) {
    const extension = bytecodePath.substring(bytecodePath.lastIndexOf('.') + 1);
    if (extension == 'json') {
        const encodedCircuit = JSON.parse(readFileSync(bytecodePath, 'utf8'));
        const decompressed = gunzipSync(Buffer.from(encodedCircuit.bytecode, 'base64'));
        return decompressed;
    }
    const encodedCircuit = readFileSync(bytecodePath);
    const decompressed = gunzipSync(encodedCircuit);
    return decompressed;
}
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
function readStack(bytecodePath, numToDrop = 0) {
    const encodedPackedZippedBytecodeArray = readFileSync(bytecodePath, 'utf-8');
    const packedZippedBytecodeArray = base64ToUint8Array(encodedPackedZippedBytecodeArray);
    const zipped = decode(packedZippedBytecodeArray.subarray(0, packedZippedBytecodeArray.length - numToDrop));
    const bytecodeArray = zipped.map((arr) => ungzip(arr));
    return bytecodeArray;
}
// TODO(https://github.com/AztecProtocol/barretenberg/issues/1126): split this into separate Plonk and Honk functions as their gate count differs
async function getGatesUltra(bytecodePath, recursive, honkRecursion, api) {
    const { total } = await computeCircuitSize(bytecodePath, recursive, honkRecursion, api);
    return total;
}
function getWitness(witnessPath) {
    const data = readFileSync(witnessPath);
    const decompressed = gunzipSync(data);
    return decompressed;
}
async function computeCircuitSize(bytecodePath, recursive, honkRecursion, api) {
    debug(`computing circuit size...`);
    const bytecode = getBytecode(bytecodePath);
    const [total, subgroup] = await api.acirGetCircuitSizes(bytecode, recursive, honkRecursion);
    return { total, subgroup };
}
async function initUltraPlonk(bytecodePath, recursive, crsPath, subgroupSizeOverride = -1, honkRecursion = false) {
    const api = await Barretenberg.new({ threads });
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/1126): use specific UltraPlonk function
    const circuitSize = await getGatesUltra(bytecodePath, recursive, honkRecursion, api);
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/811): remove subgroupSizeOverride hack for goblin
    const subgroupSize = Math.max(subgroupSizeOverride, Math.pow(2, Math.ceil(Math.log2(circuitSize))));
    if (subgroupSize > MAX_ULTRAPLONK_CIRCUIT_SIZE_IN_WASM) {
        throw new Error(`Circuit size of ${subgroupSize} exceeds max supported of ${MAX_ULTRAPLONK_CIRCUIT_SIZE_IN_WASM}`);
    }
    debug(`circuit size: ${circuitSize}`);
    debug(`subgroup size: ${subgroupSize}`);
    debug('loading crs...');
    // Plus 1 needed! (Move +1 into Crs?)
    const crs = await Crs.new(subgroupSize + 1, crsPath);
    // // Important to init slab allocator as first thing, to ensure maximum memory efficiency for Plonk.
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/1129): Do slab allocator initialization?
    // await api.commonInitSlabAllocator(subgroupSize);
    // Load CRS into wasm global CRS state.
    // TODO: Make RawBuffer be default behavior, and have a specific Vector type for when wanting length prefixed.
    await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));
    const acirComposer = await api.acirNewAcirComposer(subgroupSize);
    return { api, acirComposer, circuitSize, subgroupSize };
}
async function initUltraHonk(bytecodePath, recursive, crsPath) {
    const api = await Barretenberg.new({ threads });
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/1126): use specific UltraHonk function
    const circuitSize = await getGatesUltra(bytecodePath, recursive, /*honkRecursion=*/ true, api);
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/811): remove subgroupSizeOverride hack for goblin
    const dyadicCircuitSize = Math.pow(2, Math.ceil(Math.log2(circuitSize)));
    debug(`circuit size: ${circuitSize}`);
    debug(`dyadic circuit size size: ${dyadicCircuitSize}`);
    debug('loading crs...');
    const crs = await Crs.new(dyadicCircuitSize + 1, crsPath);
    // Load CRS into wasm global CRS state.
    // TODO: Make RawBuffer be default behavior, and have a specific Vector type for when wanting length prefixed.
    await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));
    return { api, circuitSize, dyadicCircuitSize };
}
async function initClientIVC(crsPath) {
    const api = await Barretenberg.new({ threads });
    debug('loading BN254 and Grumpkin crs...');
    const crs = await Crs.new(2 ** 21 + 1, crsPath);
    const grumpkinCrs = await GrumpkinCrs.new(2 ** 16 + 1, crsPath);
    // Load CRS into wasm global CRS state.
    // TODO: Make RawBuffer be default behavior, and have a specific Vector type for when wanting length prefixed.
    await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));
    await api.srsInitGrumpkinSrs(new RawBuffer(grumpkinCrs.getG1Data()), grumpkinCrs.numPoints);
    return { api };
}
async function initLite() {
    const api = await Barretenberg.new({ threads: 1 });
    // Plus 1 needed! (Move +1 into Crs?)
    const crs = await Crs.new(1);
    // Load CRS into wasm global CRS state.
    await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));
    const acirComposer = await api.acirNewAcirComposer(0);
    return { api, acirComposer };
}
export async function proveAndVerify(bytecodePath, recursive, witnessPath, crsPath) {
    /* eslint-disable camelcase */
    const acir_test = path.basename(process.cwd());
    const { api, acirComposer, circuitSize, subgroupSize } = await initUltraPlonk(bytecodePath, recursive, crsPath);
    try {
        debug(`creating proof...`);
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const pkTimer = new Timer();
        await api.acirInitProvingKey(acirComposer, bytecode, recursive);
        writeBenchmark('pk_construction_time', pkTimer.ms(), { acir_test, threads });
        writeBenchmark('gate_count', circuitSize, { acir_test, threads });
        writeBenchmark('subgroup_size', subgroupSize, { acir_test, threads });
        const proofTimer = new Timer();
        const proof = await api.acirCreateProof(acirComposer, bytecode, recursive, witness);
        writeBenchmark('proof_construction_time', proofTimer.ms(), { acir_test, threads });
        debug(`verifying...`);
        const verified = await api.acirVerifyProof(acirComposer, proof);
        debug(`verified: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
    /* eslint-enable camelcase */
}
export async function proveAndVerifyUltraHonk(bytecodePath, recursive, witnessPath, crsPath) {
    /* eslint-disable camelcase */
    const { api } = await initUltraHonk(bytecodePath, false, crsPath);
    try {
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const verified = await api.acirProveAndVerifyUltraHonk(bytecode, recursive, witness);
        return verified;
    }
    finally {
        await api.destroy();
    }
    /* eslint-enable camelcase */
}
export async function proveAndVerifyMegaHonk(bytecodePath, recursive, witnessPath, crsPath) {
    /* eslint-disable camelcase */
    const { api } = await initUltraPlonk(bytecodePath, false, crsPath);
    try {
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const verified = await api.acirProveAndVerifyMegaHonk(bytecode, recursive, witness);
        return verified;
    }
    finally {
        await api.destroy();
    }
    /* eslint-enable camelcase */
}
export async function proveAndVerifyAztecClient(bytecodePath, witnessPath, crsPath) {
    /* eslint-disable camelcase */
    const { api } = await initClientIVC(crsPath);
    try {
        const bytecode = readStack(bytecodePath);
        const witness = readStack(witnessPath);
        const verified = await api.acirProveAndVerifyAztecClient(bytecode, witness);
        console.log(`verified?: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
    /* eslint-enable camelcase */
}
export async function foldAndVerifyProgram(bytecodePath, recursive, witnessPath, crsPath) {
    /* eslint-disable camelcase */
    const { api } = await initClientIVC(crsPath);
    try {
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const verified = await api.acirFoldAndVerifyProgramStack(bytecode, recursive, witness);
        debug(`verified: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
    /* eslint-enable camelcase */
}
export async function prove(bytecodePath, recursive, witnessPath, crsPath, outputPath) {
    const { api, acirComposer } = await initUltraPlonk(bytecodePath, recursive, crsPath);
    try {
        debug(`creating proof...`);
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const proof = await api.acirCreateProof(acirComposer, bytecode, recursive, witness);
        debug(`done.`);
        if (outputPath === '-') {
            process.stdout.write(proof);
            debug(`proof written to stdout`);
        }
        else {
            writeFileSync(outputPath, proof);
            debug(`proof written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function gateCountUltra(bytecodePath, recursive, honkRecursion) {
    const api = await Barretenberg.new({ threads: 1 });
    try {
        const numberOfGates = await getGatesUltra(bytecodePath, recursive, honkRecursion, api);
        debug(`number of gates: : ${numberOfGates}`);
        // Create an 8-byte buffer and write the number into it.
        // Writing number directly to stdout will result in a variable sized
        // input depending on the size.
        const buffer = Buffer.alloc(8);
        buffer.writeBigInt64LE(BigInt(numberOfGates));
        process.stdout.write(buffer);
    }
    finally {
        await api.destroy();
    }
}
export async function verify(proofPath, vkPath) {
    const { api, acirComposer } = await initLite();
    try {
        await api.acirLoadVerificationKey(acirComposer, new RawBuffer(readFileSync(vkPath)));
        const verified = await api.acirVerifyProof(acirComposer, readFileSync(proofPath));
        debug(`verified: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
}
export async function contract(outputPath, vkPath) {
    const { api, acirComposer } = await initLite();
    try {
        await api.acirLoadVerificationKey(acirComposer, new RawBuffer(readFileSync(vkPath)));
        const contract = await api.acirGetSolidityVerifier(acirComposer);
        if (outputPath === '-') {
            process.stdout.write(contract);
            debug(`contract written to stdout`);
        }
        else {
            writeFileSync(outputPath, contract);
            debug(`contract written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function contractUltraHonk(bytecodePath, vkPath, crsPath, outputPath) {
    const { api } = await initUltraHonk(bytecodePath, false, crsPath);
    try {
        console.log('bytecodePath', bytecodePath);
        const bytecode = getBytecode(bytecodePath);
        console.log('vkPath', vkPath);
        const vk = new RawBuffer(readFileSync(vkPath));
        const contract = await api.acirHonkSolidityVerifier(bytecode, vk);
        if (outputPath === '-') {
            process.stdout.write(contract);
            debug(`contract written to stdout`);
        }
        else {
            writeFileSync(outputPath, contract);
            debug(`contract written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function writeVk(bytecodePath, recursive, crsPath, outputPath) {
    const { api, acirComposer } = await initUltraPlonk(bytecodePath, recursive, crsPath);
    try {
        debug('initing proving key...');
        const bytecode = getBytecode(bytecodePath);
        await api.acirInitProvingKey(acirComposer, bytecode, recursive);
        debug('initing verification key...');
        const vk = await api.acirGetVerificationKey(acirComposer);
        if (outputPath === '-') {
            process.stdout.write(vk);
            debug(`vk written to stdout`);
        }
        else {
            writeFileSync(outputPath, vk);
            debug(`vk written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function writePk(bytecodePath, recursive, crsPath, outputPath) {
    const { api, acirComposer } = await initUltraPlonk(bytecodePath, recursive, crsPath);
    try {
        debug('initing proving key...');
        const bytecode = getBytecode(bytecodePath);
        const pk = await api.acirGetProvingKey(acirComposer, bytecode, recursive);
        if (outputPath === '-') {
            process.stdout.write(pk);
            debug(`pk written to stdout`);
        }
        else {
            writeFileSync(outputPath, pk);
            debug(`pk written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function proofAsFields(proofPath, vkPath, outputPath) {
    const { api, acirComposer } = await initLite();
    try {
        debug('serializing proof byte array into field elements');
        const numPublicInputs = readFileSync(vkPath).readUint32BE(8);
        const proofAsFields = await api.acirSerializeProofIntoFields(acirComposer, readFileSync(proofPath), numPublicInputs);
        const jsonProofAsFields = JSON.stringify(proofAsFields.map(f => f.toString()));
        if (outputPath === '-') {
            process.stdout.write(jsonProofAsFields);
            debug(`proofAsFields written to stdout`);
        }
        else {
            writeFileSync(outputPath, jsonProofAsFields);
            debug(`proofAsFields written to: ${outputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
export async function vkAsFields(vkPath, vkeyOutputPath) {
    const { api, acirComposer } = await initLite();
    try {
        debug('serializing vk byte array into field elements');
        await api.acirLoadVerificationKey(acirComposer, new RawBuffer(readFileSync(vkPath)));
        const [vkAsFields, vkHash] = await api.acirSerializeVerificationKeyIntoFields(acirComposer);
        const output = [vkHash, ...vkAsFields].map(f => f.toString());
        const jsonVKAsFields = JSON.stringify(output);
        if (vkeyOutputPath === '-') {
            process.stdout.write(jsonVKAsFields);
            debug(`vkAsFields written to stdout`);
        }
        else {
            writeFileSync(vkeyOutputPath, jsonVKAsFields);
            debug(`vkAsFields written to: ${vkeyOutputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
export async function proveUltraHonk(bytecodePath, recursive, witnessPath, crsPath, outputPath, options) {
    const { api } = await initUltraHonk(bytecodePath, recursive, crsPath);
    try {
        debug(`creating proof...`);
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const acirProveUltraHonk = options?.keccak
            ? api.acirProveUltraKeccakHonk.bind(api)
            : api.acirProveUltraHonk.bind(api);
        const proof = await acirProveUltraHonk(bytecode, recursive, witness);
        debug(`done.`);
        if (outputPath === '-') {
            process.stdout.write(proof);
            debug(`proof written to stdout`);
        }
        else {
            writeFileSync(outputPath, proof);
            debug(`proof written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function writeVkUltraHonk(bytecodePath, recursive, crsPath, outputPath, options) {
    const { api } = await initUltraHonk(bytecodePath, recursive, crsPath);
    try {
        const bytecode = getBytecode(bytecodePath);
        debug('initing verification key...');
        const acirWriteVkUltraHonk = options?.keccak
            ? api.acirWriteVkUltraKeccakHonk.bind(api)
            : api.acirWriteVkUltraHonk.bind(api);
        const vk = await acirWriteVkUltraHonk(bytecode, recursive);
        if (outputPath === '-') {
            process.stdout.write(vk);
            debug(`vk written to stdout`);
        }
        else {
            writeFileSync(outputPath, vk);
            debug(`vk written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
export async function verifyUltraHonk(proofPath, vkPath, options) {
    const { api } = await initLite();
    try {
        const acirVerifyUltraHonk = options?.keccak
            ? api.acirVerifyUltraKeccakHonk.bind(api)
            : api.acirVerifyUltraHonk.bind(api);
        const verified = await acirVerifyUltraHonk(readFileSync(proofPath), new RawBuffer(readFileSync(vkPath)));
        debug(`verified: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
}
export async function proofAsFieldsUltraHonk(proofPath, outputPath) {
    const { api } = await initLite();
    try {
        debug('outputting proof as vector of fields');
        const proofAsFields = await api.acirProofAsFieldsUltraHonk(readFileSync(proofPath));
        const jsonProofAsFields = JSON.stringify(proofAsFields.map(f => f.toString()));
        if (outputPath === '-') {
            process.stdout.write(jsonProofAsFields);
            debug(`proofAsFieldsUltraHonk written to stdout`);
        }
        else {
            writeFileSync(outputPath, jsonProofAsFields);
            debug(`proofAsFieldsUltraHonk written to: ${outputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
export async function vkAsFieldsUltraHonk(vkPath, vkeyOutputPath) {
    const { api } = await initLite();
    try {
        debug('serializing vk byte array into field elements');
        const vkAsFields = await api.acirVkAsFieldsUltraHonk(new RawBuffer(readFileSync(vkPath)));
        const jsonVKAsFields = JSON.stringify(vkAsFields.map(f => f.toString()));
        if (vkeyOutputPath === '-') {
            process.stdout.write(jsonVKAsFields);
            debug(`vkAsFieldsUltraHonk written to stdout`);
        }
        else {
            writeFileSync(vkeyOutputPath, jsonVKAsFields);
            debug(`vkAsFieldsUltraHonk written to: ${vkeyOutputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
const program = new Command('bb');
program.option('-v, --verbose', 'enable verbose logging', false);
program.option('-c, --crs-path <path>', 'set crs path', './crs');
function handleGlobalOptions() {
    if (program.opts().verbose) {
        createDebug.enable('bb.js*');
    }
}
program
    .command('prove_and_verify')
    .description('Generate a proof and verify it. Process exits with success or failure code.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Whether to use a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .action(async ({ bytecodePath, recursive, witnessPath, crsPath }) => {
    handleGlobalOptions();
    const result = await proveAndVerify(bytecodePath, recursive, witnessPath, crsPath);
    process.exit(result ? 0 : 1);
});
program
    .command('prove_and_verify_ultra_honk')
    .description('Generate an UltraHonk proof and verify it. Process exits with success or failure code.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Whether to use a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .action(async ({ bytecodePath, recursive, witnessPath, crsPath }) => {
    handleGlobalOptions();
    const result = await proveAndVerifyUltraHonk(bytecodePath, recursive, witnessPath, crsPath);
    process.exit(result ? 0 : 1);
});
program
    .command('prove_and_verify_mega_honk')
    .description('Generate a MegaHonk proof and verify it. Process exits with success or failure code.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Whether to use a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .action(async ({ bytecodePath, recursive, witnessPath, crsPath }) => {
    handleGlobalOptions();
    const result = await proveAndVerifyMegaHonk(bytecodePath, recursive, witnessPath, crsPath);
    process.exit(result ? 0 : 1);
});
program
    .command('client_ivc_prove_and_verify')
    .description('Generate a ClientIVC proof.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/acir.msgpack.b64')
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witnesses.msgpack.b64')
    .action(async ({ bytecodePath, witnessPath, crsPath }) => {
    handleGlobalOptions();
    const result = await proveAndVerifyAztecClient(bytecodePath, witnessPath, crsPath);
    process.exit(result ? 0 : 1);
});
program
    .command('fold_and_verify_program')
    .description('Accumulate a set of circuits using ClientIvc then verify. Process exits with success or failure code.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .action(async ({ bytecodePath, recursive, witnessPath, crsPath }) => {
    handleGlobalOptions();
    const result = await foldAndVerifyProgram(bytecodePath, recursive, witnessPath, crsPath);
    process.exit(result ? 0 : 1);
});
program
    .command('prove')
    .description('Generate a proof and write it to a file.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .option('-o, --output-path <path>', 'Specify the proof output path', './proofs/proof')
    .action(async ({ bytecodePath, recursive, witnessPath, outputPath, crsPath }) => {
    handleGlobalOptions();
    await prove(bytecodePath, recursive, witnessPath, crsPath, outputPath);
});
program
    .command('gates')
    .description('Print Ultra Builder gate count to standard output.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .option('-hr, --honk-recursion', 'Specify whether to use UltraHonk recursion', false)
    .action(async ({ bytecodePath, recursive, honkRecursion: honkRecursion }) => {
    handleGlobalOptions();
    await gateCountUltra(bytecodePath, recursive, honkRecursion);
});
program
    .command('verify')
    .description('Verify a proof. Process exists with success or failure code.')
    .requiredOption('-p, --proof-path <path>', 'Specify the path to the proof')
    .requiredOption('-k, --vk <path>', 'path to a verification key. avoids recomputation.')
    .action(async ({ proofPath, vk }) => {
    handleGlobalOptions();
    const result = await verify(proofPath, vk);
    process.exit(result ? 0 : 1);
});
program
    .command('contract')
    .description('Output solidity verification key contract.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-o, --output-path <path>', 'Specify the path to write the contract', './target/contract.sol')
    .requiredOption('-k, --vk-path <path>', 'Path to a verification key. avoids recomputation.')
    .action(async ({ outputPath, vkPath }) => {
    handleGlobalOptions();
    await contract(outputPath, vkPath);
});
program
    .command('contract_ultra_honk')
    .description('Output solidity verification key contract.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-o, --output-path <path>', 'Specify the path to write the contract', './target/contract.sol')
    .requiredOption('-k, --vk-path <path>', 'Path to a verification key.')
    .action(async ({ bytecodePath, outputPath, vkPath, crsPath }) => {
    handleGlobalOptions();
    await contractUltraHonk(bytecodePath, vkPath, crsPath, outputPath);
});
program
    .command('write_vk')
    .description('Output verification key.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .option('-o, --output-path <path>', 'Specify the path to write the key')
    .action(async ({ bytecodePath, recursive, outputPath, crsPath }) => {
    handleGlobalOptions();
    await writeVk(bytecodePath, recursive, crsPath, outputPath);
});
program
    .command('write_pk')
    .description('Output proving key.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .requiredOption('-o, --output-path <path>', 'Specify the path to write the key')
    .action(async ({ bytecodePath, recursive, outputPath, crsPath }) => {
    handleGlobalOptions();
    await writePk(bytecodePath, recursive, crsPath, outputPath);
});
program
    .command('proof_as_fields')
    .description('Return the proof as fields elements')
    .requiredOption('-p, --proof-path <path>', 'Specify the proof path')
    .requiredOption('-k, --vk-path <path>', 'Path to verification key.')
    .requiredOption('-o, --output-path <path>', 'Specify the JSON path to write the proof fields')
    .action(async ({ proofPath, vkPath, outputPath }) => {
    handleGlobalOptions();
    await proofAsFields(proofPath, vkPath, outputPath);
});
program
    .command('vk_as_fields')
    .description('Return the verification key represented as fields elements. Also return the verification key hash.')
    .requiredOption('-k, --vk-path <path>', 'Path to verification key.')
    .requiredOption('-o, --output-path <path>', 'Specify the JSON path to write the verification key fields and key hash')
    .action(async ({ vkPath, outputPath }) => {
    handleGlobalOptions();
    await vkAsFields(vkPath, outputPath);
});
program
    .command('prove_ultra_honk')
    .description('Generate a proof and write it to a file.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .option('-o, --output-path <path>', 'Specify the proof output path', './proofs/proof')
    .action(async ({ bytecodePath, recursive, witnessPath, outputPath, crsPath }) => {
    handleGlobalOptions();
    await proveUltraHonk(bytecodePath, recursive, witnessPath, crsPath, outputPath);
});
program
    .command('prove_ultra_keccak_honk')
    .description('Generate a proof and write it to a file.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .option('-w, --witness-path <path>', 'Specify the witness path', './target/witness.gz')
    .option('-o, --output-path <path>', 'Specify the proof output path', './proofs/proof')
    .action(async ({ bytecodePath, recursive, witnessPath, outputPath, crsPath }) => {
    handleGlobalOptions();
    await proveUltraHonk(bytecodePath, recursive, witnessPath, crsPath, outputPath, { keccak: true });
});
program
    .command('write_vk_ultra_honk')
    .description('Output verification key.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .requiredOption('-o, --output-path <path>', 'Specify the path to write the key')
    .action(async ({ bytecodePath, recursive, outputPath, crsPath }) => {
    handleGlobalOptions();
    await writeVkUltraHonk(bytecodePath, recursive, crsPath, outputPath);
});
program
    .command('write_vk_ultra_keccak_honk')
    .description('Output verification key.')
    .option('-b, --bytecode-path <path>', 'Specify the bytecode path', './target/program.json')
    .option('-r, --recursive', 'Create a SNARK friendly proof', false)
    .requiredOption('-o, --output-path <path>', 'Specify the path to write the key')
    .action(async ({ bytecodePath, recursive, outputPath, crsPath }) => {
    handleGlobalOptions();
    await writeVkUltraHonk(bytecodePath, recursive, crsPath, outputPath, { keccak: true });
});
program
    .command('verify_ultra_honk')
    .description('Verify a proof. Process exists with success or failure code.')
    .requiredOption('-p, --proof-path <path>', 'Specify the path to the proof')
    .requiredOption('-k, --vk <path>', 'path to a verification key. avoids recomputation.')
    .action(async ({ proofPath, vk }) => {
    handleGlobalOptions();
    const result = await verifyUltraHonk(proofPath, vk);
    process.exit(result ? 0 : 1);
});
program
    .command('verify_ultra_keccak_honk')
    .description('Verify a proof. Process exists with success or failure code.')
    .requiredOption('-p, --proof-path <path>', 'Specify the path to the proof')
    .requiredOption('-k, --vk <path>', 'path to a verification key. avoids recomputation.')
    .action(async ({ proofPath, vk }) => {
    handleGlobalOptions();
    const result = await verifyUltraHonk(proofPath, vk, { keccak: true });
    process.exit(result ? 0 : 1);
});
program
    .command('proof_as_fields_honk')
    .description('Return the proof as fields elements')
    .requiredOption('-p, --proof-path <path>', 'Specify the proof path')
    .requiredOption('-o, --output-path <path>', 'Specify the JSON path to write the proof fields')
    .action(async ({ proofPath, outputPath }) => {
    handleGlobalOptions();
    await proofAsFieldsUltraHonk(proofPath, outputPath);
});
program
    .command('vk_as_fields_ultra_honk')
    .description('Return the verification key represented as fields elements.')
    .requiredOption('-k, --vk-path <path>', 'Path to verification key.')
    .requiredOption('-o, --output-path <path>', 'Specify the JSON path to write the verification key fields.')
    .action(async ({ vkPath, outputPath }) => {
    handleGlobalOptions();
    await vkAsFieldsUltraHonk(vkPath, outputPath);
});
program.name('bb.js').parse(process.argv);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFDQSxPQUFPLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3ZFLE9BQU8sV0FBVyxNQUFNLE9BQU8sQ0FBQztBQUNoQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxNQUFNLElBQUksQ0FBQztBQUNqRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDOUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNwQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDMUMsT0FBTyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUM3RCxPQUFPLElBQUksTUFBTSxNQUFNLENBQUM7QUFFeEIsV0FBVyxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM5QyxNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFbkMsNkVBQTZFO0FBQzdFLDRGQUE0RjtBQUM1RixFQUFFO0FBQ0YsK0RBQStEO0FBQy9ELCtEQUErRDtBQUMvRCw0Q0FBNEM7QUFDNUMsTUFBTSxtQ0FBbUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3BELE1BQU0sT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBcUIsSUFBSSxTQUFTLENBQUM7QUFFaEUsU0FBUyxXQUFXLENBQUMsWUFBb0I7SUFDdkMsTUFBTSxTQUFTLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLEdBQUcs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