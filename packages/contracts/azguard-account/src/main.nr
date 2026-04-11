mod fee_payment_method;
mod function_call;
mod public_key_note;

use aztec::macros::aztec;

#[aztec]
pub contract AzguardAccount {
    use aztec::{
        authwit::auth::{compute_authwit_message_hash, IS_VALID_SELECTOR},
        context::PrivateContext,
        macros::{
            functions::{external, initializer, noinitcheck, allow_phase_change, view},
            storage::storage,
        },
        messages::message_delivery::MessageDelivery,
        oracle::{auth_witness::get_auth_witness, notes::set_sender_for_tags},
        protocol::{
            constants::{DOM_SEP__SIGNATURE_PAYLOAD, DOM_SEP__TX_NULLIFIER},
            hash::poseidon2_hash_with_separator,
            traits::Serialize,
        },
        state_vars::SinglePrivateImmutable,
    };

    use crate::{
        fee_payment_method::FeePaymentMethod, function_call::FunctionCall,
        public_key_note::PublicKeyNote,
    };

    #[storage]
    struct Storage<Context> {
        signing_public_key: SinglePrivateImmutable<PublicKeyNote, Context>,
    }

    #[external("private")]
    #[initializer]
    fn constructor(signing_pub_key_x: Field, signing_pub_key_y: Field) {
        let pub_key_note = PublicKeyNote { x: signing_pub_key_x, y: signing_pub_key_y };
        // Safety: The sender for tags is only used to compute unconstrained shared secrets for emitting logs.
        // Since this value is only used for unconstrained tagging and not for any constrained logic,
        // it is safe to load from an unconstrained context.
        unsafe { set_sender_for_tags(self.address) };
        self.storage.signing_public_key.initialize(pub_key_note).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );
    }

    #[external("private")]
    #[noinitcheck]
    #[allow_phase_change]
    fn execute(calls: [FunctionCall; 4], nonce: Field, fee_payment_method: u8) {
        // Safety: The sender for tags is only used to compute unconstrained shared secrets for emitting logs.
        // Since this value is only used for unconstrained tagging and not for any constrained logic,
        // it is safe to set from a constrained context.
        unsafe { set_sender_for_tags(self.address) };

        // authorize
        let mut payload: BoundedVec<Field, 26> = BoundedVec::new(); // 4 * 6 + 2
        for call in calls {
            payload.extend_from_array(call.serialize());
        }
        payload.push(nonce);
        payload.push(fee_payment_method as Field);
        let payload_hash =
            poseidon2_hash_with_separator(payload.storage(), DOM_SEP__SIGNATURE_PAYLOAD);
        verify_authwit(self.context, payload_hash);

        // nullify nonce
        let nullifier = poseidon2_hash_with_separator([nonce], DOM_SEP__TX_NULLIFIER);
        self.context.push_nullifier(nullifier);

        // setup
        if (fee_payment_method != FeePaymentMethod.EXTERNAL) {
            self.context.set_as_fee_payer();

            if (fee_payment_method != FeePaymentMethod.FEE_JUICE_WITH_CLAIM) {
                self.context.end_setup();
            }
        }

        // execute
        for call in calls {
            if !call.address.is_zero() {
                if call.is_public {
                    self.context.call_public_function_with_calldata_hash(
                        call.address,
                        call.args_hash,
                        call.is_static,
                        call.hide_sender,
                    );
                } else {
                    let _ = self.context.call_private_function_with_args_hash(
                        call.address,
                        call.selector,
                        call.args_hash,
                        call.is_static,
                    );
                }
            }
        }
    }

    #[external("private")]
    #[noinitcheck]
    #[view]
    fn verify_private_authwit(inner_hash: Field) -> Field {
        let message_hash = compute_authwit_message_hash(
            self.context.maybe_msg_sender().unwrap(),
            self.context.chain_id(),
            self.context.version(),
            inner_hash,
        );
        verify_authwit(self.context, message_hash);
        IS_VALID_SELECTOR
    }

    #[contract_library_method]
    fn verify_authwit(context: &mut PrivateContext, message_hash: Field) {
        let storage = Storage::init(context);
        let public_key = storage.signing_public_key.get_note();

        // Safety: The witness is only used as a "magical value" that makes the signature verification below pass, so it's safe.
        let witness: [Field; 64] = unsafe { get_auth_witness(message_hash) };
        let mut signature: [u8; 64] = [0; 64];
        for i in 0..64 {
            signature[i] = witness[i] as u8;
        }

        let pub_key = std::embedded_curve_ops::EmbeddedCurvePoint {
            x: public_key.x,
            y: public_key.y,
            is_infinite: false,
        };

        let is_valid =
            schnorr::verify_signature(pub_key, signature, message_hash.to_be_bytes::<32>());

        assert(is_valid, "Not authorized");
    }
}
