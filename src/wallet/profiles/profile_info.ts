import { IProfileInfo } from '../abstract';

export class ProfileInfo implements IProfileInfo {
    public constructor(
        public readonly id: string,
        public name: string
    ) {}
}