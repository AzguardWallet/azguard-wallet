import { AztecAddress } from "@aztec/stdlib/aztec-address";

export const ZERO_ADDRESS = AztecAddress.zero().toString();

export function isZeroAddress(address: string): boolean {
    return address === ZERO_ADDRESS;
}

// Max fee values for simulation - actual fees are set in ExecutionService.finalizeGasLimits
export const MAX_FEE_PER_DA_GAS = BigInt(10 ** 18);
export const MAX_FEE_PER_L2_GAS = BigInt(10 ** 18);
