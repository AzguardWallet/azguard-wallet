/**
 * Profile info.
 */
export class Profile {
    /**
     * Creates Profile instance.
     * @param id Randomly generated id.
     * @param name Display name.
     */
    public constructor(
        public readonly id: string,
        public readonly name: string
    ) {}
}