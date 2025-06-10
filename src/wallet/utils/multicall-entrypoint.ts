import { MULTI_CALL_ENTRYPOINT_ADDRESS } from "@aztec/constants"
import { FunctionAbi, FunctionSelector } from "@aztec/stdlib/abi"
import { AztecAddress } from "@aztec/stdlib/aztec-address"

export const getMulticallEntrypointAddress = () => AztecAddress.fromNumber(MULTI_CALL_ENTRYPOINT_ADDRESS)

export const getMulticallEntrypointFn = () => ({
    name: "entrypoint",
    functionType: "private",
    isInternal: false,
    isStatic: false,
    isInitializer: false,
    parameters: [
        {
            name: "app_payload",
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "function_calls",
                        type: {
                            kind: "array",
                            length: 4,
                            type: {
                                kind: "struct",
                                fields: [
                                    {
                                        name: "args_hash",
                                        type: {
                                            kind: "field",
                                        },
                                    },
                                    {
                                        name: "function_selector",
                                        type: {
                                            kind: "struct",
                                            fields: [
                                                {
                                                    name: "inner",
                                                    type: {
                                                        kind: "integer",
                                                        sign: "unsigned",
                                                        width: 32,
                                                    },
                                                },
                                            ],
                                            path: "authwit::aztec::protocol_types::abis::function_selector::FunctionSelector",
                                        },
                                    },
                                    {
                                        name: "target_address",
                                        type: {
                                            kind: "struct",
                                            fields: [
                                                {
                                                    name: "inner",
                                                    type: {
                                                        kind: "field",
                                                    },
                                                },
                                            ],
                                            path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
                                        },
                                    },
                                    {
                                        name: "is_public",
                                        type: {
                                            kind: "boolean",
                                        },
                                    },
                                    {
                                        name: "is_static",
                                        type: {
                                            kind: "boolean",
                                        },
                                    },
                                ],
                                path: "authwit::entrypoint::function_call::FunctionCall",
                            },
                        },
                    },
                    {
                        name: "nonce",
                        type: {
                            kind: "field",
                        },
                    },
                ],
                path: "authwit::entrypoint::app::AppPayload",
            },
            visibility: "private",
        },
    ],
    returnTypes: [],
    errorTypes: {},
} as FunctionAbi)

export const getMulticallEntrypointSelector = async () => {
	const fn = getMulticallEntrypointFn()
	return await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters)
}
