import { Fr } from "@aztec-labs/foundation/curves/bn254";
import { FunctionSelector } from "@aztec-labs/stdlib/abi";
import type { AuthWitness } from "@aztec-labs/stdlib/auth-witness";
import { AztecAddress } from "@aztec-labs/stdlib/aztec-address";
import type { CompleteAddress } from "@aztec-labs/stdlib/contract";
import { AztecNode } from "@aztec-labs/stdlib/interfaces/client";
import type { Capsule, HashedValues, TxExecutionRequest } from "@aztec-labs/stdlib/tx";
import type { IPXE } from "@/wallet/services/pxe/client";

export * from "./azguard-v0";
export * from "./azguard-v0-persistent";

export interface IAccountContract {
    readonly address: AztecAddress;

    ensureRegistered(pxe: IPXE): Promise<void>;

    ensureContractRegistered(pxe: IPXE): Promise<void>;

    getCompleteAddress(): Promise<CompleteAddress>;

    buildAuthWitness(messageHash: Fr): Promise<AuthWitness>;

    buildTxExecutionRequest(
        node: AztecNode,
        pxe: IPXE,
        calls: AzguardFunctionCall[],
        nonce: Fr,
        feePaymentMethod: AzguardFeePaymentMethod,
        args: HashedValues[],
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
        public readonly hide_sender: boolean,
    ) {}

    public toFields(): Fr[] {
        return [
            this.address.toField(),
            this.selector.toField(),
            this.args_hash,
            new Fr(this.is_public),
            new Fr(this.is_static),
            new Fr(this.hide_sender),
        ];
    }

    public static empty(): AzguardFunctionCall {
        return new AzguardFunctionCall(AztecAddress.zero(), FunctionSelector.empty(), Fr.zero(), false, false, false);
    }
}

export enum AzguardFeePaymentMethod {
    External = 0,
    FeeJuice = 1,
    FeeJuiceWithClaim = 2,
}
