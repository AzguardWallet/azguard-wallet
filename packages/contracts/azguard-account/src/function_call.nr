use aztec::protocol::{
    abis::function_selector::FunctionSelector,
    address::AztecAddress,
    traits::{Serialize, ToField},
};
use std::meta::derive;

global FUNCTION_CALL_SIZE_IN_BYTES: u32 = 99; // 3 * 32 + 3

#[derive(Serialize)]
pub struct FunctionCall {
    pub address: AztecAddress,
    pub selector: FunctionSelector,
    pub args_hash: Field,
    pub is_public: bool,
    pub is_static: bool,
    pub hide_sender: bool,
}

impl FunctionCall {
    fn to_be_bytes(self) -> [u8; FUNCTION_CALL_SIZE_IN_BYTES] {
        let mut bytes: [u8; FUNCTION_CALL_SIZE_IN_BYTES] = [0; FUNCTION_CALL_SIZE_IN_BYTES];

        let address_bytes: [u8; 32] = self.address.to_field().to_be_bytes();
        for i in 0..32 {
            bytes[i] = address_bytes[i];
        }

        let selector_bytes: [u8; 32] = self.selector.to_field().to_be_bytes();
        for i in 0..32 {
            bytes[i + 32] = selector_bytes[i];
        }

        let args_hash_bytes: [u8; 32] = self.args_hash.to_be_bytes();
        for i in 0..32 {
            bytes[i + 64] = args_hash_bytes[i];
        }

        bytes[96] = self.is_public as u8;
        bytes[97] = self.is_static as u8;
        bytes[98] = self.hide_sender as u8;

        bytes
    }
}
