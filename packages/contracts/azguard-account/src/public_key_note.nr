use aztec::{macros::notes::note, protocol::traits::Packable};

#[derive(Eq, Packable)]
#[note]
pub struct PublicKeyNote {
    pub x: Field,
    pub y: Field,
}
