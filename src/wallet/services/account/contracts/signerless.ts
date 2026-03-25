import { GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_DA_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_L2_GAS_LIMIT } from '@aztec/constants';
import { Fr } from '@aztec/foundation/curves/bn254';
import { encodeArguments, FunctionSelector } from '@aztec/stdlib/abi';
import type { AuthWitness } from '@aztec/stdlib/auth-witness';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import type { CompleteAddress } from '@aztec/stdlib/contract';
import { Gas, GasFees, GasSettings } from '@aztec/stdlib/gas';
import { AztecNode } from '@aztec/stdlib/interfaces/client';
import {
    type Capsule,
    HashedValues,
    TxContext,
    TxExecutionRequest,
} from '@aztec/stdlib/tx';
import type { IPXE } from '@/wallet/services/pxe/client';
import {
    getMulticallEntrypointAddress,
    getMulticallEntrypointFn,
    getMulticallEntrypointSelector,
} from '@/wallet/utils/multicall-entrypoint';
import { MAX_FEE_PER_DA_GAS, MAX_FEE_PER_L2_GAS } from '@/wallet/utils/constants';
import { AzguardFeePaymentMethod, AzguardFunctionCall, IAccountContract } from '.';

/**
 * Account contract for signerless (zero-address) transactions.
 * Routes calls through the shared MulticallEntrypoint — no account contract involved.
 */
export class SignerlessAccountContract implements IAccountContract {
    public readonly address = AztecAddress.zero();

    public async ensureRegistered(_pxe: IPXE): Promise<void> {
        // no-op: signerless transactions don't have an account to register
    }

    public async ensureContractRegistered(_pxe: IPXE): Promise<void> {
        // no-op: MulticallEntrypoint is a protocol contract, always available
    }

    public async getCompleteAddress(): Promise<CompleteAddress> {
        throw new Error("SignerlessAccountContract does not have a complete address");
    }

    public async buildAuthWitness(_messageHash: Fr): Promise<AuthWitness> {
        throw new Error("SignerlessAccountContract cannot sign auth witnesses");
    }

    public async buildTxExecutionRequest(
        node: AztecNode,
        _pxe: IPXE,
        calls: AzguardFunctionCall[],
        _nonce: Fr,
        _feePaymentMethod: AzguardFeePaymentMethod,
        args: HashedValues[],
        authwits?: AuthWitness[],
        capsules?: Capsule[],
    ): Promise<TxExecutionRequest> {
        const mceFn = getMulticallEntrypointFn();
        const mceCalls = [];
        for (const call of calls) {
            mceCalls.push({
                args_hash: call.args_hash,
                function_selector: call.selector,
                target_address: call.address,
                is_public: call.is_public,
                hide_msg_sender: call.hide_sender,
                is_static: call.is_static,
            });
        }
        // Pad to 5 slots (MulticallEntrypoint expects exactly 5)
        while (mceCalls.length < 5) {
            mceCalls.push({
                args_hash: Fr.zero(),
                function_selector: FunctionSelector.empty(),
                target_address: AztecAddress.zero(),
                is_public: false,
                hide_msg_sender: false,
                is_static: false,
            });
        }

        const mceArgs = await HashedValues.fromArgs(
            encodeArguments(mceFn, [{ function_calls: mceCalls, tx_nonce: Fr.zero() }]),
        );

        const { l1ChainId, rollupVersion } = await node.getNodeInfo();
        const gasSettings = new GasSettings(
            new Gas(GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT),
            new Gas(GAS_ESTIMATION_TEARDOWN_DA_GAS_LIMIT, GAS_ESTIMATION_TEARDOWN_L2_GAS_LIMIT),
            new GasFees(MAX_FEE_PER_DA_GAS, MAX_FEE_PER_L2_GAS),
            new GasFees(0, 0),
        );
        const txContext = new TxContext(l1ChainId, rollupVersion, gasSettings);

        return new TxExecutionRequest(
            getMulticallEntrypointAddress(),
            await getMulticallEntrypointSelector(),
            mceArgs.hash,
            txContext,
            [mceArgs, ...args],
            authwits ?? [],
            capsules ?? [],
        );
    }
}
