import { AzguardFeePaymentMethod } from "../account/contracts";

export const TRANSACTION_SERVICE_NAME = "transaction";

export enum OriginType {
    UI,
    DAPP,
}

export type TxOrigin = {
    /** Origin type. */
    type: OriginType;
    /** Origin name. */
    name?: string;
};

export enum TxStatus {
    Created,
    Dropped,
    Pending,
    Success,
    AppLogicReverted,
    TeardownReverted,
    BothReverted,
}

export type TxCall = {
    /** Contract address. */
    contract: string;
    /** Function name. */
    method: string;
    /** Arguments. */
    args: any[];
    /** Additional information telling whether the call produces token transfers. */
    transfers?: TxTransfer[];
};

export enum TransferType {
    Private,
    PrivateToPublic,
    Public,
    PublicToPrivate,
}

export type TransferToken = {
    name: string;
    symbol: string;
    decimals: number;
};

export type TxTransfer = {
    /** Token info. */
    token: TransferToken;
    /** Transfer type. */
    type: TransferType;
    /** Sender. */
    from: string;
    /** Recipient. */
    to: string;
    /** Amount. */
    amount: string;
};

export type TxBlock = {
    /** Block hash. */
    hash: string;
    /** Block number/level/height. */
    number: number;
};

export type Tx = {
    /** Origin. */
    origin: TxOrigin;
    /** Chain id. */
    chainId: number;
    /** Sender address. */
    account: string;
    /** App calls. */
    calls: TxCall[];
    /** Nonce. */
    nonce: string;
    /** Fee payment method */
    feePaymentMethod: AzguardFeePaymentMethod;
    /** Transaction hash. */
    hash: string;
    /** Creation time. */
    createdAt: number;
    /** Update time. */
    updatedAt: number;
    /** Transaction status. */
    status: TxStatus;
    /** Block in which the transaction is included. */
    block?: TxBlock;
    /** Fee paid. */
    fee?: string;
    /** Error message, if some. */
    error?: string;
};

export type Methods = {
    /**
     * Returns a list of transactions for a given account.
     * @param account Account address.
     */
    getTransactions(account: string): Tx[];

    /**
     * Returns a transaction with the specified hash.
     * @param hash Transaction hash.
     */
    getTransaction(hash: string): Tx;
};

export type Events = {
    onTransactionAdded: Tx;
    onTransactionUpdated: Tx;
    onTransactionDeleted: Tx;
};
