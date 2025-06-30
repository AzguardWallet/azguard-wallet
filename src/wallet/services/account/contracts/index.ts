import { Fr } from '@aztec/foundation/fields';
import { FunctionSelector } from '@aztec/stdlib/abi';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { CompleteAddress } from '@aztec/stdlib/contract';
import { PXE } from '@aztec/stdlib/interfaces/client';
import { Capsule, HashedValues, TxExecutionRequest } from '@aztec/stdlib/tx';

export * from './azguard-v0';

export interface IAccountContract {
    readonly address: AztecAddress,

    ensureRegistered(pxe: PXE): Promise<void>;

    getCompleteAddress(): Promise<CompleteAddress>;

    buildAuthWitness(messageHash: Fr): Promise<AuthWitness>;
    
    buildTxExecutionRequest(
        pxe: PXE,
        setup: AzguardFunctionCall[],
        isFeePayer: boolean,
        calls: AzguardFunctionCall[],
        args: HashedValues[],
        nonce: Fr,
        authwits?: AuthWitness[],
        capsules?: Capsule[],
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
