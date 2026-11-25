use anchor_lang::prelude::*;

#[constant]
pub const COLLECTION_SEED: &[u8] = b"collection";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const SHARE_SEED: &[u8] = b"share";

/// The organiser's fee can be at most 1/10 of the unit price (10%).
#[constant]
pub const MAX_FEE_DIVISOR: u64 = 10;

#[constant]
pub const MAX_TITLE_LEN: u32 = 64;
