/** Transaction origin. */
export enum OriginType {
	/** Transaction originated by UI. */
	UI,
	/** Transaction originated by DAPP. */
	DAPP,
}

/** Transaction origin details. */
export class TxOrigin {
	/**
	 * Creates TxOrigin instance.
	 * @param type Origin type.
	 * @param name Origin name.
	 */
	constructor(
		public readonly type: OriginType,
		public readonly name?: string
	) {}
}

/** Transaction status. */
export enum TxStatus {
	Created,
	Dropped,
	Pending,
	Success,
	AppLogicReverted,
	TeardownReverted,
	BothReverted,
}

/** Call data. */
export class TxCall {
	/**
	 * Creates Call instance.
	 * @param contract Contract address.
	 * @param method Function name.
	 * @param args Arguments.
	 * @param transfers Additional information telling whether the call produces token transfers.
	 */
	constructor(
		public readonly contract: string,
		public readonly method: string,
		public readonly args: any[],
		public readonly transfers?: TxTransfer[]
	) {}
}

/** Token transfer type. */
export enum TransferType {
	Private,
	PrivateToPublic,
	Public,
	PublicToPrivate,
}

/** Token info. */
export class TransferToken {
	constructor(
		public readonly name: string,
		public readonly symbol: string,
		public readonly decimals: number
	) {}
}

/** Token transfer info. */
export class TxTransfer {
	/**
	 * Creates TxTransfer instance.
	 * @param token Token info.
	 * @param type Transfer type.
	 * @param from Sender.
	 * @param to Recipient.
	 * @param amount Amount.
	 */
	constructor(
		public readonly token: TransferToken,
		public readonly type: TransferType,
		public readonly from: string,
		public readonly to: string,
		public readonly amount: string
	) {}
}

/** Block info. */
export class TxBlock {
	/**
	 * Creates TxBlock instance.
	 * @param hash Block hash.
	 * @param number Block number/level/height.
	 */
	constructor(public readonly hash: string, public readonly number: number) {}
}

/**
 * Transaction info.
 */
export class Tx {
	/**
	 * Creates Transaction instance.
	 * @param origin Origin.
	 * @param chainId Chain id.
	 * @param account Sender address.
	 * @param setup Setup calls.
	 * @param calls App calls.
	 * @param nonce Nonce.
	 * @param hash Transaction hash.
	 * @param createdAt Creation time.
	 * @param updatedAt Update time.
	 * @param status Transaction status.
	 * @param block Block in which the transaction is included.
	 * @param fee Fee paid.
	 * @param error Error message, if some.
	 */
	constructor(
		public readonly origin: TxOrigin,
		public readonly chainId: number,
		public readonly account: string,
		public readonly setup: TxCall[],
		public readonly calls: TxCall[],
		public readonly nonce: string,
		public readonly hash: string,
		public readonly createdAt: number,
		public updatedAt: number,
		public status: TxStatus,
		public block?: TxBlock,
		public fee?: string,
		public error?: string
	) {}
}
