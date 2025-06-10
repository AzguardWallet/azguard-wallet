import { Fr } from "@aztec/foundation/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { AbiDecoded, AbiType, isAztecAddressStruct, parseSignedInt } from "@aztec/stdlib/abi";

/**
 * Decodes values in a flattened Field array using a provided ABI.
 * @param abi - The ABI to use as reference.
 * @param buffer - The flattened Field array to decode.
 * @returns
 */
export function decodeFromAbiPatched(typ: AbiType[], buffer: Fr[]) {
    return new AbiDecoderPatched(typ, buffer.slice()).decode();
}

/**
 * Decodes values using a provided ABI.
 */
class AbiDecoderPatched {
    constructor(private types: AbiType[], private flattened: Fr[]) {}

    /**
     * Decodes a single return value from field to the given type.
     * @param abiType - The type of the return value.
     * @returns The decoded return value.
     */
    private decodeNext(abiType: AbiType): AbiDecoded {
        switch (abiType.kind) {
            case "field":
                return this.getNextField().toBigInt();
            case "integer": {
                const nextField = this.getNextField();

                if (abiType.sign === "signed") {
                    // We parse the buffer using 2's complement
                    return parseSignedInt(nextField.toBuffer(), abiType.width);
                }

                return nextField.toBigInt();
            }
            case "boolean":
                return !this.getNextField().isZero();
            case "array": {
                const array = [];
                for (let i = 0; i < abiType.length; i += 1) {
                    array.push(this.decodeNext(abiType.type));
                }
                return array;
            }
            case "struct": {
                const struct: { [key: string]: AbiDecoded } = {};
                if (isAztecAddressStruct(abiType)) {
                    return new AztecAddress(this.getNextField().toBuffer());
                }

                for (const field of abiType.fields) {
                    struct[field.name] = this.decodeNext(field.type);
                }
                return struct;
            }
            case "string": {
                let str = "";
                for (let i = 0; i < abiType.length; i += 1) {
                    const charCode = Number(this.getNextField().toBigInt());
                    str += String.fromCharCode(charCode);
                }
                return str;
            }
            case "tuple": {
                const array = [];
                for (const tupleAbiType of abiType.fields) {
                    array.push(this.decodeNext(tupleAbiType));
                }
                return array;
            }
            default:
                throw new Error(`Unsupported type: ${abiType}`);
        }
    }

    /**
     * Gets the next field in the flattened buffer.
     * @returns The next field in the flattened buffer.
     */
    private getNextField(): Fr {
        const field = this.flattened.shift();
        if (!field) {
            throw new Error("Not enough return values");
        }
        return field;
    }

    /**
     * Decodes all the values for the given ABI.
     * The decided value can be simple types, structs or arrays
     * @returns The decoded return values.
     */
    public decode(): AbiDecoded {
        const values = [];
        for (const type of this.types) {
            values.push(this.decodeNext(type));
        }
        if (this.flattened.length) {
            throw new Error("Failed to decode from ABI: not all values were consumed");
        }
        return values.length === 1 ? values[0] : values;
    }
}
