import type { FeeSettings, AuthwitContent } from "@/wallet/services/execution/spec"

export const AUTH_REGISTRY_SERVICE_NAME = "auth-registry"

export const MAX_REVOKES_PER_TX = 28 // Aztec protocol limitation

export type Authwit = {
	/** Internal id. */
	id: number
	/** Account created the authwit. */
	account: string
	/** Message hash. */
	hash: string
	/** Plain content. */
	content: AuthwitContent
}

export type Methods = {
	/**
	 * Returns a list of tracked public authwits for the account.
	 * @param account Account address.
	 */
	getAuthwits(account: string): Authwit[]
	/**
	 * Revokes up to MAX_REVOKES_PER_TX authwits (sends a transaction).
	 * @param networkId Network id.
	 * @param account Account address.
	 * @param ids Ids of the authwits to revoke.
	 * @param feeSettings Fee settings to be used for sending the transaction.
	 */
	revokeAuthwits(networkId: string, account: string, ids: number[], feeSettings: FeeSettings): void
	/**
	 * Returns whether or not the auth registry is enabled for the account.
	 * @param account Account address.
	 */
	getRegistryEnabled(account: string): boolean
	/**
	 * Enables or disables auth registry for the account (sends a transaction).
	 * @param networkId Network id.
	 * @param account Account address.
	 * @param enabled Whether to enable or disable the auth registry.
	 * @param feeSettings Fee settings to be used for sending the transaction.
	 */
	setRegistryEnabled(networkId: string, account: string, enabled: boolean, feeSettings: FeeSettings): void
	/**
	 * Triggers synchronization of the auth registry for the account.
	 * @param networkId Network id.
	 * @param account Account address.
	 */
	syncRegistry(networkId: string, account: string): void
}

export type Events = {
	/** Emitted when a new authwit is added */
	onAuthwitAdded: Authwit
	/** Emitted when an existing authwit is deleted */
	onAuthwitDeleted: Authwit
	/** Emitted when an auth registry is enabled */
	onRegistryEnabled: string
	/** Emitted when an auth registry is disabled */
	onRegistryDisabled: string
}
