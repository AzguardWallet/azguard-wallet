import { EventMessage } from "@/wallet/base/port-service/messages";
import { AUTH_REGISTRY_SERVICE_NAME, Authwit } from ".";

export enum AuthRegistryServiceEvent {
    AuthwitAdded,
    AuthwitDeleted,
    RegistryEnabled,
    RegistryDisabled,
}

export class AuthRegistryServiceEventMessage extends EventMessage {
    constructor(
        event: AuthRegistryServiceEvent,
        public readonly data: Authwit | string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, event);
    }
}
