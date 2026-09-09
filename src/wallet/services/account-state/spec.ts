import { type ContractArtifact} from "@aztec/stdlib/abi";
import { type ContractInstancePreimageWithAddress } from "@aztec/stdlib/contract";
import { Restored } from "@/wallet/base";

export const ACCOUNT_STATE_SERVICE_NAME = "account-state";

export type BackupSender = {
    address: string;
}
export type BackupContract = {
    address: string;
    instance: ContractInstancePreimageWithAddress;
    /** key into BackupAccountState.artifacts */
    classId: string;
};
export type BackupAccountState = {
    networkId: string;
    senders: Restored<BackupSender>[];
    contracts: Restored<BackupContract>[];
    /** one artifact per contract class, keyed by originalContractClassId */
    artifacts: Record<string, ContractArtifact>;
};

export type RestoredAddress = {
    address: string;
    restoreError?: unknown;
};

/** Restore outcome, slim by contract: addresses and errors only, no artifact echo. */
export type RestoredAccountState = {
    networkId: string;
    senders: RestoredAddress[];
    contracts: RestoredAddress[];
};

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
};

export type Events = {
    /** Emitted when a new sender is added */
    onSenderAdded: string;
    /** Emitted when an existing sender is deleted */
    onSenderDeleted: string;
};
