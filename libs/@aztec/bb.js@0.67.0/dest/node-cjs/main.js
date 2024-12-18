#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vkAsFieldsUltraHonk = exports.proofAsFieldsUltraHonk = exports.verifyUltraHonk = exports.writeVkUltraHonk = exports.proveUltraHonk = exports.vkAsFields = exports.proofAsFields = exports.writePk = exports.writeVk = exports.contractUltraHonk = exports.contract = exports.verify = exports.gateCountUltra = exports.prove = exports.foldAndVerifyProgram = exports.proveAndVerifyAztecClient = exports.proveAndVerifyMegaHonk = exports.proveAndVerifyUltraHonk = exports.proveAndVerify = void 0;
const tslib_1 = require("tslib");
const index_js_1 = require("./index.js");
const debug_1 = tslib_1.__importDefault(require("debug"));
const fs_1 = require("fs");
const zlib_1 = require("zlib");
const pako_1 = require("pako");
const commander_1 = require("commander");
const msgpack_1 = require("@msgpack/msgpack");
const index_js_2 = require("./benchmark/index.js");
const path_1 = tslib_1.__importDefault(require("path"));
debug_1.default.log = console.error.bind(console);
const debug = (0, debug_1.default)('bb.js');
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
        const encodedCircuit = JSON.parse((0, fs_1.readFileSync)(bytecodePath, 'utf8'));
        const decompressed = (0, zlib_1.gunzipSync)(Buffer.from(encodedCircuit.bytecode, 'base64'));
        return decompressed;
    }
    const encodedCircuit = (0, fs_1.readFileSync)(bytecodePath);
    const decompressed = (0, zlib_1.gunzipSync)(encodedCircuit);
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
    const encodedPackedZippedBytecodeArray = (0, fs_1.readFileSync)(bytecodePath, 'utf-8');
    const packedZippedBytecodeArray = base64ToUint8Array(encodedPackedZippedBytecodeArray);
    const zipped = (0, msgpack_1.decode)(packedZippedBytecodeArray.subarray(0, packedZippedBytecodeArray.length - numToDrop));
    const bytecodeArray = zipped.map((arr) => (0, pako_1.ungzip)(arr));
    return bytecodeArray;
}
// TODO(https://github.com/AztecProtocol/barretenberg/issues/1126): split this into separate Plonk and Honk functions as their gate count differs
async function getGatesUltra(bytecodePath, recursive, honkRecursion, api) {
    const { total } = await computeCircuitSize(bytecodePath, recursive, honkRecursion, api);
    return total;
}
function getWitness(witnessPath) {
    const data = (0, fs_1.readFileSync)(witnessPath);
    const decompressed = (0, zlib_1.gunzipSync)(data);
    return decompressed;
}
async function computeCircuitSize(bytecodePath, recursive, honkRecursion, api) {
    debug(`computing circuit size...`);
    const bytecode = getBytecode(bytecodePath);
    const [total, subgroup] = await api.acirGetCircuitSizes(bytecode, recursive, honkRecursion);
    return { total, subgroup };
}
async function initUltraPlonk(bytecodePath, recursive, crsPath, subgroupSizeOverride = -1, honkRecursion = false) {
    const api = await index_js_1.Barretenberg.new({ threads });
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
    const crs = await index_js_1.Crs.new(subgroupSize + 1, crsPath);
    // // Important to init slab allocator as first thing, to ensure maximum memory efficiency for Plonk.
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/1129): Do slab allocator initialization?
    // await api.commonInitSlabAllocator(subgroupSize);
    // Load CRS into wasm global CRS state.
    // TODO: Make RawBuffer be default behavior, and have a specific Vector type for when wanting length prefixed.
    await api.srsInitSrs(new index_js_1.RawBuffer(crs.getG1Data()), crs.numPoints, new index_js_1.RawBuffer(crs.getG2Data()));
    const acirComposer = await api.acirNewAcirComposer(subgroupSize);
    return { api, acirComposer, circuitSize, subgroupSize };
}
async function initUltraHonk(bytecodePath, recursive, crsPath) {
    const api = await index_js_1.Barretenberg.new({ threads });
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/1126): use specific UltraHonk function
    const circuitSize = await getGatesUltra(bytecodePath, recursive, /*honkRecursion=*/ true, api);
    // TODO(https://github.com/AztecProtocol/barretenberg/issues/811): remove subgroupSizeOverride hack for goblin
    const dyadicCircuitSize = Math.pow(2, Math.ceil(Math.log2(circuitSize)));
    debug(`circuit size: ${circuitSize}`);
    debug(`dyadic circuit size size: ${dyadicCircuitSize}`);
    debug('loading crs...');
    const crs = await index_js_1.Crs.new(dyadicCircuitSize + 1, crsPath);
    // Load CRS into wasm global CRS state.
    // TODO: Make RawBuffer be default behavior, and have a specific Vector type for when wanting length prefixed.
    await api.srsInitSrs(new index_js_1.RawBuffer(crs.getG1Data()), crs.numPoints, new index_js_1.RawBuffer(crs.getG2Data()));
    return { api, circuitSize, dyadicCircuitSize };
}
async function initClientIVC(crsPath) {
    const api = await index_js_1.Barretenberg.new({ threads });
    debug('loading BN254 and Grumpkin crs...');
    const crs = await index_js_1.Crs.new(2 ** 21 + 1, crsPath);
    const grumpkinCrs = await index_js_1.GrumpkinCrs.new(2 ** 16 + 1, crsPath);
    // Load CRS into wasm global CRS state.
    // TODO: Make RawBuffer be default behavior, and have a specific Vector type for when wanting length prefixed.
    await api.srsInitSrs(new index_js_1.RawBuffer(crs.getG1Data()), crs.numPoints, new index_js_1.RawBuffer(crs.getG2Data()));
    await api.srsInitGrumpkinSrs(new index_js_1.RawBuffer(grumpkinCrs.getG1Data()), grumpkinCrs.numPoints);
    return { api };
}
async function initLite() {
    const api = await index_js_1.Barretenberg.new({ threads: 1 });
    // Plus 1 needed! (Move +1 into Crs?)
    const crs = await index_js_1.Crs.new(1);
    // Load CRS into wasm global CRS state.
    await api.srsInitSrs(new index_js_1.RawBuffer(crs.getG1Data()), crs.numPoints, new index_js_1.RawBuffer(crs.getG2Data()));
    const acirComposer = await api.acirNewAcirComposer(0);
    return { api, acirComposer };
}
async function proveAndVerify(bytecodePath, recursive, witnessPath, crsPath) {
    /* eslint-disable camelcase */
    const acir_test = path_1.default.basename(process.cwd());
    const { api, acirComposer, circuitSize, subgroupSize } = await initUltraPlonk(bytecodePath, recursive, crsPath);
    try {
        debug(`creating proof...`);
        const bytecode = getBytecode(bytecodePath);
        const witness = getWitness(witnessPath);
        const pkTimer = new index_js_2.Timer();
        await api.acirInitProvingKey(acirComposer, bytecode, recursive);
        (0, index_js_2.writeBenchmark)('pk_construction_time', pkTimer.ms(), { acir_test, threads });
        (0, index_js_2.writeBenchmark)('gate_count', circuitSize, { acir_test, threads });
        (0, index_js_2.writeBenchmark)('subgroup_size', subgroupSize, { acir_test, threads });
        const proofTimer = new index_js_2.Timer();
        const proof = await api.acirCreateProof(acirComposer, bytecode, recursive, witness);
        (0, index_js_2.writeBenchmark)('proof_construction_time', proofTimer.ms(), { acir_test, threads });
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
exports.proveAndVerify = proveAndVerify;
async function proveAndVerifyUltraHonk(bytecodePath, recursive, witnessPath, crsPath) {
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
exports.proveAndVerifyUltraHonk = proveAndVerifyUltraHonk;
async function proveAndVerifyMegaHonk(bytecodePath, recursive, witnessPath, crsPath) {
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
exports.proveAndVerifyMegaHonk = proveAndVerifyMegaHonk;
async function proveAndVerifyAztecClient(bytecodePath, witnessPath, crsPath) {
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
exports.proveAndVerifyAztecClient = proveAndVerifyAztecClient;
async function foldAndVerifyProgram(bytecodePath, recursive, witnessPath, crsPath) {
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
exports.foldAndVerifyProgram = foldAndVerifyProgram;
async function prove(bytecodePath, recursive, witnessPath, crsPath, outputPath) {
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
            (0, fs_1.writeFileSync)(outputPath, proof);
            debug(`proof written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.prove = prove;
async function gateCountUltra(bytecodePath, recursive, honkRecursion) {
    const api = await index_js_1.Barretenberg.new({ threads: 1 });
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
exports.gateCountUltra = gateCountUltra;
async function verify(proofPath, vkPath) {
    const { api, acirComposer } = await initLite();
    try {
        await api.acirLoadVerificationKey(acirComposer, new index_js_1.RawBuffer((0, fs_1.readFileSync)(vkPath)));
        const verified = await api.acirVerifyProof(acirComposer, (0, fs_1.readFileSync)(proofPath));
        debug(`verified: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
}
exports.verify = verify;
async function contract(outputPath, vkPath) {
    const { api, acirComposer } = await initLite();
    try {
        await api.acirLoadVerificationKey(acirComposer, new index_js_1.RawBuffer((0, fs_1.readFileSync)(vkPath)));
        const contract = await api.acirGetSolidityVerifier(acirComposer);
        if (outputPath === '-') {
            process.stdout.write(contract);
            debug(`contract written to stdout`);
        }
        else {
            (0, fs_1.writeFileSync)(outputPath, contract);
            debug(`contract written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.contract = contract;
async function contractUltraHonk(bytecodePath, vkPath, crsPath, outputPath) {
    const { api } = await initUltraHonk(bytecodePath, false, crsPath);
    try {
        console.log('bytecodePath', bytecodePath);
        const bytecode = getBytecode(bytecodePath);
        console.log('vkPath', vkPath);
        const vk = new index_js_1.RawBuffer((0, fs_1.readFileSync)(vkPath));
        const contract = await api.acirHonkSolidityVerifier(bytecode, vk);
        if (outputPath === '-') {
            process.stdout.write(contract);
            debug(`contract written to stdout`);
        }
        else {
            (0, fs_1.writeFileSync)(outputPath, contract);
            debug(`contract written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.contractUltraHonk = contractUltraHonk;
async function writeVk(bytecodePath, recursive, crsPath, outputPath) {
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
            (0, fs_1.writeFileSync)(outputPath, vk);
            debug(`vk written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.writeVk = writeVk;
async function writePk(bytecodePath, recursive, crsPath, outputPath) {
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
            (0, fs_1.writeFileSync)(outputPath, pk);
            debug(`pk written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.writePk = writePk;
async function proofAsFields(proofPath, vkPath, outputPath) {
    const { api, acirComposer } = await initLite();
    try {
        debug('serializing proof byte array into field elements');
        const numPublicInputs = (0, fs_1.readFileSync)(vkPath).readUint32BE(8);
        const proofAsFields = await api.acirSerializeProofIntoFields(acirComposer, (0, fs_1.readFileSync)(proofPath), numPublicInputs);
        const jsonProofAsFields = JSON.stringify(proofAsFields.map(f => f.toString()));
        if (outputPath === '-') {
            process.stdout.write(jsonProofAsFields);
            debug(`proofAsFields written to stdout`);
        }
        else {
            (0, fs_1.writeFileSync)(outputPath, jsonProofAsFields);
            debug(`proofAsFields written to: ${outputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
exports.proofAsFields = proofAsFields;
async function vkAsFields(vkPath, vkeyOutputPath) {
    const { api, acirComposer } = await initLite();
    try {
        debug('serializing vk byte array into field elements');
        await api.acirLoadVerificationKey(acirComposer, new index_js_1.RawBuffer((0, fs_1.readFileSync)(vkPath)));
        const [vkAsFields, vkHash] = await api.acirSerializeVerificationKeyIntoFields(acirComposer);
        const output = [vkHash, ...vkAsFields].map(f => f.toString());
        const jsonVKAsFields = JSON.stringify(output);
        if (vkeyOutputPath === '-') {
            process.stdout.write(jsonVKAsFields);
            debug(`vkAsFields written to stdout`);
        }
        else {
            (0, fs_1.writeFileSync)(vkeyOutputPath, jsonVKAsFields);
            debug(`vkAsFields written to: ${vkeyOutputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
exports.vkAsFields = vkAsFields;
async function proveUltraHonk(bytecodePath, recursive, witnessPath, crsPath, outputPath, options) {
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
            (0, fs_1.writeFileSync)(outputPath, proof);
            debug(`proof written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.proveUltraHonk = proveUltraHonk;
async function writeVkUltraHonk(bytecodePath, recursive, crsPath, outputPath, options) {
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
            (0, fs_1.writeFileSync)(outputPath, vk);
            debug(`vk written to: ${outputPath}`);
        }
    }
    finally {
        await api.destroy();
    }
}
exports.writeVkUltraHonk = writeVkUltraHonk;
async function verifyUltraHonk(proofPath, vkPath, options) {
    const { api } = await initLite();
    try {
        const acirVerifyUltraHonk = options?.keccak
            ? api.acirVerifyUltraKeccakHonk.bind(api)
            : api.acirVerifyUltraHonk.bind(api);
        const verified = await acirVerifyUltraHonk((0, fs_1.readFileSync)(proofPath), new index_js_1.RawBuffer((0, fs_1.readFileSync)(vkPath)));
        debug(`verified: ${verified}`);
        return verified;
    }
    finally {
        await api.destroy();
    }
}
exports.verifyUltraHonk = verifyUltraHonk;
async function proofAsFieldsUltraHonk(proofPath, outputPath) {
    const { api } = await initLite();
    try {
        debug('outputting proof as vector of fields');
        const proofAsFields = await api.acirProofAsFieldsUltraHonk((0, fs_1.readFileSync)(proofPath));
        const jsonProofAsFields = JSON.stringify(proofAsFields.map(f => f.toString()));
        if (outputPath === '-') {
            process.stdout.write(jsonProofAsFields);
            debug(`proofAsFieldsUltraHonk written to stdout`);
        }
        else {
            (0, fs_1.writeFileSync)(outputPath, jsonProofAsFields);
            debug(`proofAsFieldsUltraHonk written to: ${outputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
exports.proofAsFieldsUltraHonk = proofAsFieldsUltraHonk;
async function vkAsFieldsUltraHonk(vkPath, vkeyOutputPath) {
    const { api } = await initLite();
    try {
        debug('serializing vk byte array into field elements');
        const vkAsFields = await api.acirVkAsFieldsUltraHonk(new index_js_1.RawBuffer((0, fs_1.readFileSync)(vkPath)));
        const jsonVKAsFields = JSON.stringify(vkAsFields.map(f => f.toString()));
        if (vkeyOutputPath === '-') {
            process.stdout.write(jsonVKAsFields);
            debug(`vkAsFieldsUltraHonk written to stdout`);
        }
        else {
            (0, fs_1.writeFileSync)(vkeyOutputPath, jsonVKAsFields);
            debug(`vkAsFieldsUltraHonk written to: ${vkeyOutputPath}`);
        }
        debug('done.');
    }
    finally {
        await api.destroy();
    }
}
exports.vkAsFieldsUltraHonk = vkAsFieldsUltraHonk;
const program = new commander_1.Command('bb');
program.option('-v, --verbose', 'enable verbose logging', false);
program.option('-c, --crs-path <path>', 'set crs path', './crs');
function handleGlobalOptions() {
    if (program.opts().verbose) {
        debug_1.default.enable('bb.js*');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQ0EseUNBQXVFO0FBQ3ZFLDBEQUFnQztBQUNoQywyQkFBaUQ7QUFDakQsK0JBQWtDO0FBQ2xDLCtCQUE4QjtBQUM5Qix5Q0FBb0M7QUFDcEMsOENBQTBDO0FBQzFDLG1EQUE2RDtBQUM3RCx3REFBd0I7QUFFeEIsZUFBVyxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM5QyxNQUFNLEtBQUssR0FBRyxJQUFBLGVBQVcsRUFBQyxPQUFPLENBQUMsQ0FBQztBQUVuQyw2RUFBNkU7QUFDN0UsNEZBQTRGO0FBQzVGLEVBQUU7QUFDRiwrREFBK0Q7QUFDL0QsK0RBQStEO0FBQy9ELDRDQUE0QztBQUM1QyxNQUFNLG1DQUFtQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDcEQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFxQixJQUFJLFNBQVMsQ0FBQztBQUVoRSxTQUFTLFdBQVcsQ0FBQyxZQUFvQjtJQUN2QyxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFNUUsSUFBSSxTQUFTLElBQUksTUFBTSxFQUFFLENBQUM7UUFDeEIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFBLGlCQUFZLEVBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDdEUsTUFBTSxZQUFZLEdBQUcsSUFBQSxpQkFBVSxFQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sWUFBWSxDQUFDO0lBQ3RCLENBQUM7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