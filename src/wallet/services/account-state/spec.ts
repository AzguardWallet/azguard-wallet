export const ACCOUNT_STATE_SERVICE_NAME = "account-state";

export type Methods = {
    /**
     * Returns a list of registered accounts.
     * @param networkId Network id.
     */
    getAccounts(networkId: string): string[];

    /**
     * Returns a list of registered senders.
     * @param networkId Network id.
     */
    getSenders(networkId: string): string[];

    /**
     * Adds a sender.
     * @param networkId Network id.
     * @param address Sender address.
     * @emits `SenderAdded` event.
     */
    addSender(networkId: string, address: string): string;

    /**
     * Deletes a sender.
     * @param networkId Network id.
     * @param address Sender address.
     * @emits `SenderDeleted` event.
     */
    deleteSender(networkId: string, address: string): string;

    /**
     * Returns a list of registered contracts.
     * @param networkId Network id.
     */
    getContracts(networkId: string): string[];

    /**
     * Returns PXE version.
     * @param networkId Network id.
     */
    getVersion(networkId: string): string;
};

export type Events = {
    /** Emitted when a new sender is added */
    onSenderAdded: string;
    /** Emitted when an existing sender is deleted */
    onSenderDeleted: string;
};
