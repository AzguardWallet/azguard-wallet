export const NETWORK_SERVICE_NAME = "network";

export enum NodeStatus {
    Active,
    Inactive,
    InvalidChain,
}

export type Network = {
    /** Randomly generated id. */
    id: string;
    /** Profile id. */
    profileId: string;
    /** Display name. */
    name: string;
    /** RPC URL. */
    rpcUrl: string;
    /** Chain id, automatically determined from the RPC. */
    chainId: number;
    /** Whether or not this node is default for the given chain */
    isDefault: boolean;
};

export type Methods = {
    /**
     * Returns a list of existing nodes if any, or seeds and returns default nodes otherwise.
     */
    getOrInitNetworks(): Network[];

    /**
     * Returns a list of nodes.
     * @param chainId Chain id.
     */
    getNetworks(chainId?: number): Network[];

    /**
     * Returns a node with the specified id.
     * @param id Node id.
     */
    getNetwork(id: string): Network;

    /**
     * Creates and returns a new node.
     * @param name Display name.
     * @param rpcUrl RPC URL the wallet will connect to.
     */
    addNetwork(name: string, rpcUrl: string): Network;

    /**
     * Changes node display name and RPC URL and returns the updated node.
     * @param id Node id.
     * @param name New display name.
     * @param rpcUrl New RPC URL.
     */
    updateNetwork(id: string, name: string, rpcUrl: string): Network;

    /**
     * Deletes node with the specified id.
     * @param id Node id.
     */
    deleteNetwork(id: string): Network;

    /**
     * Set the node with the specified id as the default node within the same chain.
     * @param id Node id.
     */
    setDefault(id: string): Network;

    /**
     * Fetches and validates node info from RPC, and returns the status.
     * @param id Node id.
     */
    getNodeStatus(id: string): NodeStatus;
};

export type Events = {
    /** Emitted when a new node is added */
    onNetworkAdded: Network;
    /** Emitted when an existing node is updated */
    onNetworkUpdatd: Network;
    /** Emitted when an existing node is deleted */
    onNetworkDeleted: Network;
    /** Emitted when a default node for a given chain is changed */
    onDefaultNetworkChanged: Network;
};
