use anchor_lang::prelude::*;

#[event]
pub struct CollectionCreated {
    pub collection: Pubkey,
    pub organizer: Pubkey,
    pub vendor: Pubkey,
    pub unit_price: u64,
    pub fee_per_unit: u64,
    pub max_units: u32,
}

#[event]
pub struct SharePaid {
    pub collection: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ShareCancelled {
    pub collection: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CollectionLocked {
    pub collection: Pubkey,
    pub paid_count: u32,
}

#[event]
pub struct CollectionCancelled {
    pub collection: Pubkey,
}

#[event]
pub struct SharePickedUp {
    pub collection: Pubkey,
    pub buyer: Pubkey,
    pub to_vendor: u64,
    pub to_organizer: u64,
}

#[event]
pub struct ShareRefunded {
    pub collection: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}
