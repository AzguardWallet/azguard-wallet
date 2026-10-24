import { STANDARD_AUTH_REGISTRY_ADDRESS } from "@aztec-labs/standard-contracts/auth-registry/constants";
import { Fr } from "@aztec-labs/foundation/curves/bn254";
import { FunctionAbi, FunctionSelector, FunctionType } from "@aztec-labs/stdlib/abi";
import { AztecAddress } from "@aztec-labs/stdlib/aztec-address";
import { deriveStorageSlotInMap } from "@aztec-labs/stdlib/hash";
import { AztecNode } from "@aztec-labs/stdlib/interfaces/client";

// Auth Registry storage slots — hardcoded from the contract's storage layout, so NOT reliable:
// a struct field reorder silently shifts them (it did on the v5 bump).
// TODO(backlog): switch to `AuthRegistry.utility_is_consumable` & `AuthRegistry.is_reject_all`
//               view fns to drop the slot dependency entirely.
const APPROVED_ACTIONS_SLOT = new Fr(2);
const REJECT_ALL_SLOT = new Fr(1);

export const getAuthRegistryAddress = () => STANDARD_AUTH_REGISTRY_ADDRESS;

export const getSetAuthorizedFn = () =>
    ({
        name: "set_authorized",
        functionType: FunctionType.PUBLIC,
        isOnlySelf: false,
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
        errorTypes: {},
    } as FunctionAbi);

export const getSetAuthorizedSelector = async () => {
    const fn = getSetAuthorizedFn();
    return await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
};

export const isAuthwitConsumable = async (node: AztecNode, account: string, message_hash: string) => {
    const slot = await deriveStorageSlotInMap(
        await deriveStorageSlotInMap(
            APPROVED_ACTIONS_SLOT,
            AztecAddress.fromStringUnsafe(account),
        ),
        Fr.fromString(message_hash),
    );
    const approved = await node.getPublicStorageAt("latest", getAuthRegistryAddress(), slot);
    return !approved.isZero();
};

export const isAuthRegistryEnabled = async (node: AztecNode, account: string) => {
    const slot = await deriveStorageSlotInMap(
        REJECT_ALL_SLOT,
        AztecAddress.fromStringUnsafe(account),
    );
    const rejectAll = await node.getPublicStorageAt("latest", getAuthRegistryAddress(), slot);
    return rejectAll.isZero();
};
