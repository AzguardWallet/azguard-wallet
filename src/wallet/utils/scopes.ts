import { AztecAddress } from "@aztec/stdlib/aztec-address";

/**
 * The accounts a dApp's transaction options ask the PXE to read besides the
 * sender: `additionalScopes` first, then `sendMessagesAs`. Empty when the
 * options name neither.
 */
export function dappScopes(opts: {
    additionalScopes?: AztecAddress[];
    sendMessagesAs?: AztecAddress;
}): AztecAddress[] {
    return [...(opts.additionalScopes ?? []), ...(opts.sendMessagesAs ? [opts.sendMessagesAs] : [])];
}
