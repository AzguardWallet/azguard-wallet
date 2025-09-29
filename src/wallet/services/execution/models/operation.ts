import type { Action, CallAction, EncodedCallAction, FeeSettings } from ".";

export type Operation =
    | GetCompleteAddressOperation
    | RegisterContractOperation
    | RegisterSenderOperation
    | RegisterTokenOperation
    | SendTransactionOperation
    | SimulateTransactionOperation
    | SimulateUtilityOperation
    | SimulateViewsOperation;

export type OperationKind = Operation["kind"];

export type GetCompleteAddressOperation = {
    readonly kind: "get_complete_address";
    readonly networkId: string;
    readonly accountAddress: string;
};

export type RegisterContractOperation = {
    readonly kind: "register_contract";
    readonly networkId: string;
    readonly address: string;
    readonly instance?: unknown;
    readonly artifact?: unknown;
};

export type RegisterSenderOperation = {
    readonly kind: "register_sender";
    readonly networkId: string;
    readonly address: string;
};

export type RegisterTokenOperation = {
    readonly kind: "register_token";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly address: string;
};

export type SendTransactionOperation = {
    readonly kind: "send_transaction";
    readonly networkId: string;
    readonly accountAddress: string;
    feeSettings: FeeSettings;
    readonly actions: Action[];
    setup?: Action[];
};

export type SimulateTransactionOperation = {
    readonly kind: "simulate_transaction";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly actions: Action[];
    readonly setup?: Action[];
    readonly simulatePublic?: boolean;
};

export type SimulateUtilityOperation = {
    readonly kind: "simulate_utility";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly contract: string;
    readonly method: string;
    readonly args: any[];
};

export type SimulateViewsOperation = {
    readonly kind: "simulate_views";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly calls: (CallAction | EncodedCallAction)[];
};
