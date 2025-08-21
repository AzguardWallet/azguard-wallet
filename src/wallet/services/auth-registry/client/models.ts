import { IAuthwitContent } from "@/wallet/services/execution/client";

export class Authwit {
    /**
     * Creates Authwit instance
     * @param id Internal id.
     * @param account Account created the authwit.
     * @param hash Message hash.
     * @param content Plain content.
     */
    constructor(
        public readonly id: number,
        public readonly account: string,
        public readonly hash: string,
        public readonly content: IAuthwitContent,
    ) {}
}
