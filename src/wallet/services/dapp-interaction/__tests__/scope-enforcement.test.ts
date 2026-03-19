import { describe, expect, test } from "vitest";
import {
    enforceCapabilityScope,
    type SerializedScope,
    type SerializedAccountsCapability,
    type SerializedContractsCapability,
    type SerializedContractClassesCapability,
    type SerializedSimulationCapability,
    type SerializedTransactionCapability,
    type SerializedDataCapability,
} from "../scope-enforcement";
import type { OperationRequest } from "../spec";

const ADDR_A = "0x1111111111111111111111111111111111111111111111111111111111111111";
const ADDR_B = "0x2222222222222222222222222222222222222222222222222222222222222222";
const ADDR_C = "0x3333333333333333333333333333333333333333333333333333333333333333";
const CLASS_ID_A = "0xaaaa";

const mockAddress = (hex: string) => ({ toString: () => hex });

// --- Operation builders ---

const registerContractOp = (address: string) =>
    ({
        kind: "aztec_registerContract",
        chain: "aztec:1",
        instance: { address: mockAddress(address) },
    }) as any as OperationRequest;

const getContractMetadataOp = (address: string) =>
    ({
        kind: "aztec_getContractMetadata",
        chain: "aztec:1",
        address: mockAddress(address),
    }) as any as OperationRequest;

const getContractClassMetadataOp = (id: string) =>
    ({
        kind: "aztec_getContractClassMetadata",
        chain: "aztec:1",
        id: mockAddress(id),
    }) as any as OperationRequest;

const sendTxOp = (calls: { to: string; name: string }[]) =>
    ({
        kind: "aztec_sendTx",
        account: "aztec:1:" + ADDR_A,
        exec: {
            calls: calls.map(c => ({ to: mockAddress(c.to), name: c.name })),
        },
    }) as any as OperationRequest;

const simulateTxOp = (calls: { to: string; name: string }[]) =>
    ({
        kind: "aztec_simulateTx",
        account: "aztec:1:" + ADDR_A,
        exec: {
            calls: calls.map(c => ({ to: mockAddress(c.to), name: c.name })),
        },
    }) as any as OperationRequest;

const profileTxOp = (calls: { to: string; name: string }[]) =>
    ({
        kind: "aztec_profileTx",
        account: "aztec:1:" + ADDR_A,
        exec: {
            calls: calls.map(c => ({ to: mockAddress(c.to), name: c.name })),
        },
    }) as any as OperationRequest;

const executeUtilityOp = (to: string, name: string) =>
    ({
        kind: "aztec_executeUtility",
        account: "aztec:1:" + ADDR_A,
        call: { to: mockAddress(to), name },
        opts: { scope: mockAddress(ADDR_A) },
    }) as any as OperationRequest;

const getPrivateEventsOp = (contractAddress: string) =>
    ({
        kind: "aztec_getPrivateEvents",
        chain: "aztec:1",
        eventFilter: { contractAddress: mockAddress(contractAddress) },
    }) as any as OperationRequest;

// --- Capability builders ---

const contractsCap = (
    opts: Omit<SerializedContractsCapability, "type">,
): SerializedContractsCapability => ({ type: "contracts", ...opts });

const contractClassesCap = (
    opts: Omit<SerializedContractClassesCapability, "type">,
): SerializedContractClassesCapability => ({ type: "contractClasses", ...opts });

const transactionCap = (scope: SerializedScope): SerializedTransactionCapability => ({
    type: "transaction",
    scope,
});

const simulationCap = (
    opts: Omit<SerializedSimulationCapability, "type">,
): SerializedSimulationCapability => ({ type: "simulation", ...opts });

const dataCap = (
    opts: Omit<SerializedDataCapability, "type">,
): SerializedDataCapability => ({ type: "data", ...opts });

const accountsCap = (
    opts: Omit<SerializedAccountsCapability, "type">,
): SerializedAccountsCapability => ({ type: "accounts", ...opts });

const createAuthWitOp = (accountAddress: string) =>
    ({
        kind: "aztec_createAuthWit",
        account: "aztec:1:" + accountAddress,
        messageHashOrIntent: {},
    }) as any as OperationRequest;

// --- Tests ---

describe("contracts — registerContract", () => {
    test("wildcard contracts passes", () => {
        const caps = [contractsCap({ contracts: "*", canRegister: true })];
        expect(() => enforceCapabilityScope(caps, registerContractOp(ADDR_A))).not.toThrow();
    });

    test("exact address match passes", () => {
        const caps = [contractsCap({ contracts: [ADDR_A], canRegister: true })];
        expect(() => enforceCapabilityScope(caps, registerContractOp(ADDR_A))).not.toThrow();
    });

    test("no contracts capability throws", () => {
        expect(() => enforceCapabilityScope([], registerContractOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("canRegister not set throws", () => {
        const caps = [contractsCap({ contracts: "*", canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, registerContractOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("wrong address throws", () => {
        const caps = [contractsCap({ contracts: [ADDR_B], canRegister: true })];
        expect(() => enforceCapabilityScope(caps, registerContractOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("multi-cap — second cap matches passes", () => {
        const caps = [
            contractsCap({ contracts: [ADDR_B], canRegister: true }),
            contractsCap({ contracts: [ADDR_A], canRegister: true }),
        ];
        expect(() => enforceCapabilityScope(caps, registerContractOp(ADDR_A))).not.toThrow();
    });
});

describe("contracts — getContractMetadata", () => {
    test("wildcard contracts passes", () => {
        const caps = [contractsCap({ contracts: "*", canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, getContractMetadataOp(ADDR_A))).not.toThrow();
    });

    test("exact address match passes", () => {
        const caps = [contractsCap({ contracts: [ADDR_A], canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, getContractMetadataOp(ADDR_A))).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() => enforceCapabilityScope([], getContractMetadataOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("wrong address throws", () => {
        const caps = [contractsCap({ contracts: [ADDR_B], canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, getContractMetadataOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });
});

describe("contractClasses — getContractClassMetadata", () => {
    test("wildcard classes passes", () => {
        const caps = [contractClassesCap({ classes: "*", canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, getContractClassMetadataOp(CLASS_ID_A))).not.toThrow();
    });

    test("exact id match passes", () => {
        const caps = [contractClassesCap({ classes: [CLASS_ID_A], canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, getContractClassMetadataOp(CLASS_ID_A))).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() => enforceCapabilityScope([], getContractClassMetadataOp(CLASS_ID_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("wrong id throws", () => {
        const caps = [contractClassesCap({ classes: ["0xbbbb"], canGetMetadata: true })];
        expect(() => enforceCapabilityScope(caps, getContractClassMetadataOp(CLASS_ID_A))).toThrow(
            "Operation not in capability scope",
        );
    });
});

describe("transaction — sendTx", () => {
    test("wildcard scope passes", () => {
        const caps = [transactionCap("*")];
        expect(() => enforceCapabilityScope(caps, sendTxOp([{ to: ADDR_A, name: "transfer" }]))).not.toThrow();
    });

    test("pattern match passes", () => {
        const caps = [transactionCap([{ contract: ADDR_A, function: "transfer" }])];
        expect(() => enforceCapabilityScope(caps, sendTxOp([{ to: ADDR_A, name: "transfer" }]))).not.toThrow();
    });

    test("wildcard function in pattern passes", () => {
        const caps = [transactionCap([{ contract: ADDR_A, function: "*" }])];
        expect(() => enforceCapabilityScope(caps, sendTxOp([{ to: ADDR_A, name: "transfer" }]))).not.toThrow();
    });

    test("wildcard contract in pattern passes", () => {
        const caps = [transactionCap([{ contract: "*", function: "transfer" }])];
        expect(() => enforceCapabilityScope(caps, sendTxOp([{ to: ADDR_A, name: "transfer" }]))).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() => enforceCapabilityScope([], sendTxOp([{ to: ADDR_A, name: "transfer" }]))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("one call fails throws", () => {
        const caps = [transactionCap([{ contract: ADDR_A, function: "transfer" }])];
        expect(() =>
            enforceCapabilityScope(
                caps,
                sendTxOp([
                    { to: ADDR_A, name: "transfer" },
                    { to: ADDR_B, name: "mint" },
                ]),
            ),
        ).toThrow("Operation not in capability scope");
    });

    test("mixed wildcard and exact patterns", () => {
        const caps = [
            transactionCap([
                { contract: ADDR_A, function: "*" },
                { contract: ADDR_B, function: "mint" },
            ]),
        ];
        expect(() =>
            enforceCapabilityScope(
                caps,
                sendTxOp([
                    { to: ADDR_A, name: "transfer" },
                    { to: ADDR_B, name: "mint" },
                ]),
            ),
        ).not.toThrow();
    });
});

describe("transaction — sendTx multi-call with separate caps", () => {
    test("3 calls covered by separate caps passes", () => {
        const caps = [
            transactionCap([{ contract: ADDR_A, function: "pay_fee" }]),
            transactionCap([{ contract: ADDR_B, function: "*" }]),
        ];
        expect(() =>
            enforceCapabilityScope(
                caps,
                sendTxOp([
                    { to: ADDR_A, name: "pay_fee" },
                    { to: ADDR_B, name: "transfer" },
                    { to: ADDR_B, name: "approve" },
                ]),
            ),
        ).not.toThrow();
    });

    test("3 calls with only one cap covering some fails", () => {
        const caps = [transactionCap([{ contract: ADDR_A, function: "pay_fee" }])];
        expect(() =>
            enforceCapabilityScope(
                caps,
                sendTxOp([
                    { to: ADDR_A, name: "pay_fee" },
                    { to: ADDR_B, name: "transfer" },
                    { to: ADDR_B, name: "approve" },
                ]),
            ),
        ).toThrow("Operation not in capability scope");
    });
});

describe("simulation — simulateTx", () => {
    test("wildcard scope passes", () => {
        const caps = [simulationCap({ transactions: { scope: "*" } })];
        expect(() =>
            enforceCapabilityScope(caps, simulateTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).not.toThrow();
    });

    test("pattern match passes", () => {
        const caps = [simulationCap({ transactions: { scope: [{ contract: ADDR_A, function: "transfer" }] } })];
        expect(() =>
            enforceCapabilityScope(caps, simulateTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() =>
            enforceCapabilityScope([], simulateTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).toThrow("Operation not in capability scope");
    });

    test("one call fails throws", () => {
        const caps = [simulationCap({ transactions: { scope: [{ contract: ADDR_A, function: "transfer" }] } })];
        expect(() =>
            enforceCapabilityScope(
                caps,
                simulateTxOp([
                    { to: ADDR_A, name: "transfer" },
                    { to: ADDR_B, name: "mint" },
                ]),
            ),
        ).toThrow("Operation not in capability scope");
    });

    test("simulation cap without transactions sub-cap throws", () => {
        const caps = [simulationCap({ utilities: { scope: "*" } })];
        expect(() =>
            enforceCapabilityScope(caps, simulateTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).toThrow("Operation not in capability scope");
    });
});

describe("simulation — profileTx", () => {
    test("wildcard scope passes", () => {
        const caps = [simulationCap({ transactions: { scope: "*" } })];
        expect(() =>
            enforceCapabilityScope(caps, profileTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).not.toThrow();
    });

    test("pattern match passes", () => {
        const caps = [simulationCap({ transactions: { scope: [{ contract: ADDR_A, function: "transfer" }] } })];
        expect(() =>
            enforceCapabilityScope(caps, profileTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() =>
            enforceCapabilityScope([], profileTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).toThrow("Operation not in capability scope");
    });
});

describe("simulation — executeUtility", () => {
    test("wildcard scope passes", () => {
        const caps = [simulationCap({ utilities: { scope: "*" } })];
        expect(() => enforceCapabilityScope(caps, executeUtilityOp(ADDR_A, "balance_of"))).not.toThrow();
    });

    test("pattern match passes", () => {
        const caps = [
            simulationCap({ utilities: { scope: [{ contract: ADDR_A, function: "balance_of" }] } }),
        ];
        expect(() => enforceCapabilityScope(caps, executeUtilityOp(ADDR_A, "balance_of"))).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() => enforceCapabilityScope([], executeUtilityOp(ADDR_A, "balance_of"))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("no match throws", () => {
        const caps = [
            simulationCap({ utilities: { scope: [{ contract: ADDR_B, function: "balance_of" }] } }),
        ];
        expect(() => enforceCapabilityScope(caps, executeUtilityOp(ADDR_A, "balance_of"))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("simulation cap without utilities sub-cap throws", () => {
        const caps = [simulationCap({ transactions: { scope: "*" } })];
        expect(() => enforceCapabilityScope(caps, executeUtilityOp(ADDR_A, "balance_of"))).toThrow(
            "Operation not in capability scope",
        );
    });
});

describe("data — getPrivateEvents", () => {
    test("wildcard contracts passes", () => {
        const caps = [dataCap({ privateEvents: { contracts: "*" } })];
        expect(() => enforceCapabilityScope(caps, getPrivateEventsOp(ADDR_A))).not.toThrow();
    });

    test("address match passes", () => {
        const caps = [dataCap({ privateEvents: { contracts: [ADDR_A] } })];
        expect(() => enforceCapabilityScope(caps, getPrivateEventsOp(ADDR_A))).not.toThrow();
    });

    test("no capability throws", () => {
        expect(() => enforceCapabilityScope([], getPrivateEventsOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("wrong address throws", () => {
        const caps = [dataCap({ privateEvents: { contracts: [ADDR_B] } })];
        expect(() => enforceCapabilityScope(caps, getPrivateEventsOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("data cap without privateEvents throws", () => {
        const caps = [dataCap({ addressBook: true })];
        expect(() => enforceCapabilityScope(caps, getPrivateEventsOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });
});

describe("skip operations — pass with empty capabilities", () => {
    const skipKinds = [
        { kind: "aztec_getChainInfo", chain: "aztec:1" },
        { kind: "aztec_registerSender", chain: "aztec:1", address: mockAddress(ADDR_A) },
        { kind: "aztec_getAccounts", chain: "aztec:1" },
        { kind: "aztec_getAddressBook", chain: "aztec:1" },
    ] as any as OperationRequest[];

    for (const op of skipKinds) {
        test(`${op.kind} passes with empty caps`, () => {
            expect(() => enforceCapabilityScope([], op)).not.toThrow();
        });
    }
});

describe("multiple same-type capabilities", () => {
    test("ANY matching transaction cap allows", () => {
        const caps = [
            transactionCap([{ contract: ADDR_B, function: "mint" }]),
            transactionCap([{ contract: ADDR_A, function: "transfer" }]),
        ];
        expect(() => enforceCapabilityScope(caps, sendTxOp([{ to: ADDR_A, name: "transfer" }]))).not.toThrow();
    });

    test("all caps checked before rejecting", () => {
        const caps = [
            transactionCap([{ contract: ADDR_B, function: "mint" }]),
            transactionCap([{ contract: ADDR_C, function: "approve" }]),
        ];
        expect(() => enforceCapabilityScope(caps, sendTxOp([{ to: ADDR_A, name: "transfer" }]))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("ANY matching contracts cap allows registerContract", () => {
        const caps = [
            contractsCap({ contracts: [ADDR_B], canRegister: true }),
            contractsCap({ contracts: "*", canRegister: true }),
        ];
        expect(() => enforceCapabilityScope(caps, registerContractOp(ADDR_A))).not.toThrow();
    });

    test("ANY matching simulation cap allows simulateTx", () => {
        const caps = [
            simulationCap({ transactions: { scope: [{ contract: ADDR_B, function: "mint" }] } }),
            simulationCap({ transactions: { scope: [{ contract: ADDR_A, function: "transfer" }] } }),
        ];
        expect(() =>
            enforceCapabilityScope(caps, simulateTxOp([{ to: ADDR_A, name: "transfer" }])),
        ).not.toThrow();
    });

    test("ANY matching data cap allows getPrivateEvents", () => {
        const caps = [
            dataCap({ privateEvents: { contracts: [ADDR_B] } }),
            dataCap({ privateEvents: { contracts: [ADDR_A] } }),
        ];
        expect(() => enforceCapabilityScope(caps, getPrivateEventsOp(ADDR_A))).not.toThrow();
    });
});

describe("accounts — createAuthWit", () => {
    test("account with canCreateAuthWit passes", () => {
        const caps = [accountsCap({
            canCreateAuthWit: true,
            accounts: [{ alias: "A", item: ADDR_A }],
        })];
        expect(() => enforceCapabilityScope(caps, createAuthWitOp(ADDR_A))).not.toThrow();
    });

    test("no accounts capability throws", () => {
        expect(() => enforceCapabilityScope([], createAuthWitOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("canCreateAuthWit not set throws", () => {
        const caps = [accountsCap({
            canGet: true,
            accounts: [{ alias: "A", item: ADDR_A }],
        })];
        expect(() => enforceCapabilityScope(caps, createAuthWitOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("account not in capability throws", () => {
        const caps = [accountsCap({
            canCreateAuthWit: true,
            accounts: [{ alias: "B", item: ADDR_B }],
        })];
        expect(() => enforceCapabilityScope(caps, createAuthWitOp(ADDR_A))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("multi-cap — canCreateAuthWit on different cap than account throws", () => {
        const caps = [
            accountsCap({
                canCreateAuthWit: true,
                accounts: [{ alias: "A", item: ADDR_A }],
            }),
            accountsCap({
                canGet: true,
                accounts: [{ alias: "B", item: ADDR_B }],
            }),
        ];
        // ADDR_B is in an accounts capability WITHOUT canCreateAuthWit — must fail
        expect(() => enforceCapabilityScope(caps, createAuthWitOp(ADDR_B))).toThrow(
            "Operation not in capability scope",
        );
    });

    test("multi-cap — second cap with canCreateAuthWit passes", () => {
        const caps = [
            accountsCap({
                canGet: true,
                accounts: [{ alias: "A", item: ADDR_A }],
            }),
            accountsCap({
                canCreateAuthWit: true,
                accounts: [{ alias: "B", item: ADDR_B }],
            }),
        ];
        expect(() => enforceCapabilityScope(caps, createAuthWitOp(ADDR_B))).not.toThrow();
    });
});
