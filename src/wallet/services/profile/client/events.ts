import { EventMessage } from "@/wallet/base/port-service/messages";
import { Profile, PROFILE_SERVICE_NAME } from ".";

export enum ProfileServiceEvent {
    ProfileAdded,
    ProfileUpdated,
    ProfileDeleted,
    ActiveProfileChanged,
}

export class ProfileServiceEventMessage extends EventMessage {
    constructor(
        event: ProfileServiceEvent,
        public readonly profile?: Profile
    ) {
        super(PROFILE_SERVICE_NAME, event);
    }
}