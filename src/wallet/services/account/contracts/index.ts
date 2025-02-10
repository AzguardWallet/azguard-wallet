import { AuthWitness, AztecAddress, Fr, FunctionSelector, HashedValues, PXE, TxExecutionRequest } from '@aztec/aztec.js';

export * from './azguard-v0';

export interface IAccountContract {
    readonly address: AztecAddress,

    buildAuthWitness(messageHash: Fr): Promise<AuthWitness>;
    
    buildTxExecutionRequest(
        pxe: PXE,
        setup: AzguardFunctionCall[],
        calls: AzguardFunctionCall[],
        args: HashedValues[],
        nonce: Fr,
    ): Promise<TxExecutionRequest>;
}

export class AzguardFunctionCall {
    constructor(
        public readonly address: AztecAddress,
        public readonly selector: FunctionSelector,
        public readonly args_hash: Fr,
        public readonly is_public: boolean,
        public readonly is_static: boolean,
    ) {}

    public toFields(): Fr[] {
        return [
            this.address.toField(),
            this.selector.toField(),
            this.args_hash,
            new Fr(this.is_public),
            new Fr(this.is_static),
        ]
    }

    public static empty(): AzguardFunctionCall {
        return new AzguardFunctionCall(AztecAddress.zero(), FunctionSelector.empty(), Fr.zero(), false, false); 
    }
}