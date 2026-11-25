use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum CollectionStatus {
    /// Accepting payments. Buyers may cancel before pay-by.
    Open,
    /// Enough buyers paid; the vendor delivers and pickups release shares.
    Locked,
    /// The organiser cancelled before lock; every share is refundable.
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ShareStatus {
    Paid,
    PickedUp,
    Refunded,
}

/// One class purchase: e.g. "BIO 201 textbook, 40 copies".
#[account]
#[derive(InitSpace)]
pub struct Collection {
    pub organizer: Pubkey,
    pub vendor: Pubkey,
    /// Key held at the vendor's pickup stand. It must co-sign every pickup.
    pub station: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub collection_id: u64,
    #[max_len(64)]
    pub title: String,
    /// Paid to the vendor per pickup (token base units).
    pub unit_price: u64,
    /// Paid to the organiser per pickup (token base units). At most unit_price / 10.
    pub fee_per_unit: u64,
    pub min_buyers: u32,
    pub max_units: u32,
    pub pay_by: i64,
    pub pickup_by: i64,
    pub status: CollectionStatus,
    /// Shares currently in the Paid state (money still in the vault).
    pub paid_count: u32,
    pub picked_count: u32,
    pub refunded_count: u32,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Collection {
    pub fn share_amount(&self) -> Result<u64> {
        self.unit_price
            .checked_add(self.fee_per_unit)
            .ok_or(error!(crate::error::MeridioError::Overflow))
    }
}

/// One student's share of one collection.
#[account]
#[derive(InitSpace)]
pub struct Share {
    pub collection: Pubkey,
    pub buyer: Pubkey,
    /// unit_price + fee_per_unit, locked in at payment time.
    pub amount: u64,
    pub status: ShareStatus,
    pub paid_at: i64,
    pub settled_at: i64,
    pub bump: u8,
}
