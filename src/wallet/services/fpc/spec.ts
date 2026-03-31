export const FPC_SERVICE_NAME = "fpc";

export enum FpcType {
    DefaultFpc,
    DefaultSponsoredFpc,
    PrivateFpc,
    // TokenFpc,  // Placeholder — Human Tech (coming soon)
}

export type FpcInfo = {
    id: string;
    profileId: string;
    chainId: number;
    type: FpcType;
    address: string;
    name?: string;
    asset?: string;
    acceptsPrivate?: boolean;
    acceptsPublic?: boolean;
};

export type Methods = {
    /**
     * Returns a list of FPCs.
     * @param chainId Filter by chain id.
     */
    getFpcs(chainId?: number): FpcInfo[];

    /**
     * Returns a FPC with the specified id.
     * @param id FPC id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the fpc with the specified id doesn't exist within the active profile.
     */
    getFpc(id: string): FpcInfo;

    /**
     * Adds a new FPC.
     * @param networkId Network id.
     * @param type FPC type.
     * @param address FPC address.
     * @param name Alias name.
     */
    addFpc(networkId: string, type: FpcType, address: string, name?: string): FpcInfo;

    /**
     * Changes fpc display name and returns the updated fpc.
     * @param id FPC id.
     * @param name New display name.
     */
    updateFpc(id: string, name: string): FpcInfo;

    /**
     * Deletes an FPC.
     * @param id FPC id.
     */
    deleteFpc(id: string): FpcInfo;
};

export type Events = {
    /** Emitted when a new FPC is added */
    onFpcAdded: FpcInfo;
    /** Emitted when an existing FPC is updated */
    onFpcUpdated: FpcInfo;
    /** Emitted when an existing FPC is deleted */
    onFpcDeleted: FpcInfo;
};
