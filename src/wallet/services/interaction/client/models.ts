/**
 * Dapp connection info.
 */
export class Dapp {
    /**
     * Creates Dapp instance.
     * @param id Randomly generated id.
     * @param name Display name.
     */
    constructor(
        public readonly id: string,
        public readonly name: string,
    ) {}
}
