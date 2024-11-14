import { EventMessage } from "@/wallet/base/messages";
import { Profile, PROFILE_SERVICE_NAME } from ".";

export enum ProfileServiceEvent {
    ProfileAdded,
    ProfileUpdated,
    ProfileDeleted,
    ProfileUnlocked,
    Locked,
}

export class ProfileServiceEventMessage extends EventMessage {
    constructor(
        event: ProfileServiceEvent,
        public readonly profile?: Profile
    ) {
        super(PROFILE_SERVICE_NAME, event);
    }
}