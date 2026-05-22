import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { Fr } from "@aztec/foundation/curves/bn254";
import { PrivateFPCContractArtifact } from "@/wallet/services/fpc/artifacts";

export const privateFpcName = "Private Fee Juice";

export const privateFpcSymbol = "pFJ";

let _address: string | undefined;
export async function getPrivateFpcAddress(): Promise<string> {
    if (!_address) {
        const instance = await getContractInstanceFromInstantiationParams(PrivateFPCContractArtifact, {
            constructorArgs: [],
            salt: Fr.zero(),
        });
        _address = instance.address.toString();
    }
    return _address;
}
