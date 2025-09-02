export const RPC_SERVICE_NAME = "rpc";

export type GenericRpcEvent = {
    event: string;
    payload: [string, any];
};

export type Methods = {
    /**
     * Invokes specified method with the specified args.
     * @param fn Name of the function to invoke.
     * @param args Arguments to pass.
     */
    invoke(fn: string, args: unknown): [string, unknown];
};

export type Events = {
    /** Emitted on external RPC events */
    onGenericEvent: GenericRpcEvent;
};
