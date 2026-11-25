use anchor_lang::prelude::*;

use crate::{error::MeridioError, events::CollectionLocked, state::*};

/// Freeze the order once enough buyers have paid.
/// The organiser may lock early; after pay-by, anyone may lock.
#[derive(Accounts)]
pub struct Lock<'info> {
    pub caller: Signer<'info>,
    #[account(mut)]
    pub collection: Account<'info, Collection>,
}

pub fn handle_lock(ctx: Context<Lock>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let c = &mut ctx.accounts.collection;
    require!(c.status == CollectionStatus::Open, MeridioError::NotOpen);
    require!(now <= c.pickup_by, MeridioError::PickupByPassed);
    if now <= c.pay_by {
        require_keys_eq!(ctx.accounts.caller.key(), c.organizer, MeridioError::OrganizerOnly);
    }
    require!(c.paid_count >= c.min_buyers, MeridioError::NotEnoughBuyers);
    c.status = CollectionStatus::Locked;
    emit!(CollectionLocked {
        collection: c.key(),
        paid_count: c.paid_count,
    });
    Ok(())
}
