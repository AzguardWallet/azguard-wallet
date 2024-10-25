import { IProfileInfo } from '../abstract/profiles';

export class ProfileInfo implements IProfileInfo {
    public constructor(
        public readonly id: string,
        public name: string
    ) {}
}