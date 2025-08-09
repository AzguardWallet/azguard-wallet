export const contactColors = ["blue", "green", "mint", "neutral-mint", "orange", "yellow", "red", "purple", "gray", "sand"]

export class Contact {
	/**
	 * Creates Contact.
	 * @param id Randomly generated contact id.
     * @param profileId Profile id.
	 * @param name Contact name.
	 * @param address Contact address.
	 * @param abbr Contact name abbreviation (1–2 letters).
	 * @param color Contact abbr color.
	 */
	constructor(
		public readonly id: string,
        public readonly profileId: string,
		public readonly name: string,
		public readonly address: string,
		public readonly abbr: string,
		public readonly color: string,
	) {}
}
