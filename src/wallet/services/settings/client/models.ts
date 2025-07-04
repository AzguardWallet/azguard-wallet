export type SettingValue = boolean | number | string

export class Setting {
	/**
	 * Creates Setting.
	 * @param key Setting key.
	 * @param value Setting value.
	 */
    constructor(
        public readonly key: string,
        public readonly value: SettingValue
    ) {}
}
