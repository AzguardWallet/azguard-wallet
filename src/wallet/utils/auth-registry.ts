import { AztecAddress } from "@aztec/aztec.js";
import { FunctionAbi, FunctionSelector } from "@aztec/foundation/abi";

export const getAuthRegistryAddress = () => AztecAddress.fromBigInt(1n);

export const getSetAuthorizedFn = () => ({
    name: "set_authorized",
    functionType: "public",
    isInternal: false,
    isStatic: false,
    isInitializer: false,
    parameters: [
        {
          name: "message_hash",
          type: { kind: "field" },
          visibility: "private",
        },
        {
          name: "authorize",
          type: { kind: "boolean" },
          visibility: "private",
        },
      ],
    returnTypes: [],
} as FunctionAbi);

export const getSetAuthorizedSelector = () => {
    const fn = getSetAuthorizedFn();
    return FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
};