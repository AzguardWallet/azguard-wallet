export enum FpcType {
    DefaultFpc,
    DefaultSponsoredFpc,
}

export class FpcInfo {
    public constructor(
        public readonly id: string,
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly type: FpcType,
        public readonly address: string,
        public readonly name?: string,
        public readonly asset?: string,
        public readonly acceptsPrivate?: boolean,
        public readonly acceptsPublic?: boolean,
    ) {}
}
