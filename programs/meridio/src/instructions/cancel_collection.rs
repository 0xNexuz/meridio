use anchor_lang::prelude::*;

use crate::{error::MeridioError, events::CollectionCancelled, state::*};

/// The organiser calls the order off before it locks. Every share becomes refundable.
#[derive(Accounts)]
pub struct CancelCollection<'info> {
    pub organizer: Signer<'info>,
    #[account(mut, has_one = organizer @ MeridioError::OrganizerOnly)]
    pub collection: Account<'info, Collection>,
}

pub fn handle_cancel_collection(ctx: Context<CancelCollection>) -> Result<()> {
    let c = &mut ctx.accounts.collection;
    require!(c.status == CollectionStatus::Open, MeridioError::NotOpen);
    c.status = CollectionStatus::Cancelled;
    emit!(CollectionCancelled { collection: c.key() });
    Ok(())
}
