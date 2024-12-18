"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenFieldsAsArray = exports.deflattenFields = exports.reconstructUltraPlonkProof = exports.reconstructHonkProof = exports.splitHonkProof = void 0;
// Buffers are prepended with their size. The size takes 4 bytes.
const serializedBufferSize = 4;
const fieldByteSize = 32;
const publicInputOffset = 3;
const publicInputsOffsetBytes = publicInputOffset * fieldByteSize;
function splitHonkProof(proofWithPublicInputs) {
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
    const publicInputs = proofWithPublicInputs.slice(publicInputsOffset, publicInputsOffset + publicInputsSplitIndex);
    return {
        proof,
        publicInputs,
    };
}
exports.splitHonkProof = splitHonkProof;
function reconstructHonkProof(publicInputs, proof) {
    const proofStart = proof.slice(0, publicInputsOffsetBytes + serializedBufferSize);
    const proofEnd = proof.slice(publicInputsOffsetBytes + serializedBufferSize);
    // Concatenate publicInputs and proof
    const proofWithPublicInputs = Uint8Array.from([...proofStart, ...publicInputs, ...proofEnd]);
    return proofWithPublicInputs;
}
exports.reconstructHonkProof = reconstructHonkProof;
function reconstructUltraPlonkProof(proofData) {
    // Flatten publicInputs
    const publicInputsConcatenated = flattenFieldsAsArray(proofData.publicInputs);
    // Concatenate publicInputs and proof
    const proofWithPublicInputs = Uint8Array.from([...publicInputsConcatenated, ...proofData.proof]);
    return proofWithPublicInputs;
}
exports.reconstructUltraPlonkProof = reconstructUltraPlonkProof;
function deflattenFields(flattenedFields) {
    const publicInputSize = 32;
    const chunkedFlattenedPublicInputs = [];
    for (let i = 0; i < flattenedFields.length; i += publicInputSize) {
        const publicInput = flattenedFields.slice(i, i + publicInputSize);
        chunkedFlattenedPublicInputs.push(publicInput);
    }
    return chunkedFlattenedPublicInputs.map(uint8ArrayToHex);
}
exports.deflattenFields = deflattenFields;
function flattenFieldsAsArray(fields) {
    const flattenedPublicInputs = fields.map(hexToUint8Array);
    return flattenUint8Arrays(flattenedPublicInputs);
}
exports.flattenFieldsAsArray = flattenFieldsAsArray;
function flattenUint8Arrays(arrays) {
    const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
function uint8ArrayToHex(buffer) {
    const hex = [];
    buffer.forEach(function (i) {
        let h = i.toString(16);
        if (h.length % 2) {
            h = '0' + h;
        }
        hex.push(h);
    });
    return '0x' + hex.join('');
}
function hexToUint8Array(hex) {
    const sanitisedHex = BigInt(hex).toString(16).padStart(64, '0');
    const len = sanitisedHex.length / 2;
    const u8 = new Uint8Array(len);
    let i = 0;
    let j = 0;
    while (i < len) {
        u8[i] = parseInt(sanitisedHex.slice(j, j + 2), 16);
        i += 1;
        j += 2;
    }
    return u8;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvb2YvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBV0EsaUVBQWlFO0FBQ2pFLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO0FBQy9CLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN6QixNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUM1QixNQUFNLHVCQUF1QixHQUFHLGlCQUFpQixHQUFHLGFBQWEsQ0FBQztBQUVsRSxTQUFnQixjQUFjLENBQUMscUJBQWlDO0lBQzlELE1BQU0sY0FBYyxHQUFHLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV2RSxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFbEQsa0RBQWtEO0lBQ2xELE1BQU0sa0JBQWtCLEdBQUcsdUJBQXVCLEdBQUcsb0JBQW9CLENBQUM7SUFDMUUsa0RBQWtEO0lBQ2xELE1BQU0sVUFBVSxHQUFHLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUN0RSxNQUFNLHNCQUFzQixHQUFHLGVBQWUsR0FBRyxhQUFhLENBQUM7SUFDL0QsTUFBTSxRQUFRLEdBQUcscUJBQXFCLENBQUMsS0FBSyxDQUFDLGtCQUFrQixHQUFHLHNCQUFzQixDQUFDLENBQUM7SUFDMUYsZ0RBQWdEO0lBQ2hELE1BQU0sS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsR0FBRyxVQUFVLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRTNELDREQUE0RDtJQUM1RCxNQUFNLFlBQVksR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUUsa0JBQWtCLEdBQUcsc0JBQXNCLENBQUMsQ0FBQztJQUVsSCxPQUFPO1FBQ0wsS0FB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