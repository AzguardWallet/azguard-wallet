import type { AbiType } from "@aztec/stdlib/abi";

// Canonical ABI path of aztec-nr's AztecAddress struct.
export const AZTEC_ADDRESS_PATH = "aztec::protocol_types::address::aztec_address::AztecAddress";

// Canonical ABI path of aztec-nr's FieldCompressedString struct (name/symbol return type).
export const FIELD_COMPRESSED_STRING_PATH = "compressed_string::field_compressed_string::FieldCompressedString";

// Match by suffix: the path is either exactly canonical, or crate-prefixed when the type is
// resolved through a dependency — ARC-403's `authorize_once` namespaces AztecAddress under the
// auth crate (e.g. "authorization_contract::…::AztecAddress"). Only the leading prefix varies;
// the same can happen to any struct pulled in via a dependency, hence suffix matching.
export function isAztecAddressType(type: AbiType): boolean {
    return type.kind === "struct" && type.path.endsWith(AZTEC_ADDRESS_PATH);
}

export function isFieldCompressedStringType(type: AbiType): boolean {
    return type.kind === "struct" && type.path.endsWith(FIELD_COMPRESSED_STRING_PATH);
}
