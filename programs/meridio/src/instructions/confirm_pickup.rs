use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*, error::MeridioError, events::SharePickedUp, instructions::vault::transfer_from_vault,
    state::*,
};

/// The student collects the item at the vendor's stand.
/// Both the student and the vendor's station key sign the same transaction,
/// so a pickup cannot be confirmed by either side alone.
#[derive(Accounts)]
pub struct ConfirmPickup<'info> {
    pub buyer: Signer<'info>,
    pub station: Signer<'info>,
    #[account(
        mut,
        has_one = mint,
        has_one = vault,
        has_one = station,
    )]
    pub collection: Account<'info, Collection>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [SHARE_SEED, collection.key().as_ref(), buyer.key().as_ref()],
        bump = share.bump,
        has_one = buyer,
        has_one = collection,
    )]
    pub share: Account<'info, Share>,
    #[account(
        mut,
        token::mint = mint,
        constraint = vendor_token.owner == collection.vendor,
    )]
    pub vendor_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        constraint = organizer_token.owner == collection.organizer,
    )]
    pub organizer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_confirm_pickup(ctx: Context<ConfirmPickup>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let c = &ctx.accounts.collection;
    require!(c.status == CollectionStatus::Locked, MeridioError::NotLocked);
    require!(now <= c.pickup_by, MeridioError::PickupByPassed);
    require!(ctx.accounts.share.status == ShareStatus::Paid, MeridioError::ShareNotPaid);

    // The share amount was fixed at payment; split it exactly.
    let amount = ctx.accounts.share.amount;
    let to_organizer = c.fee_per_unit;
    let to_vendor = amount.checked_sub(to_organizer).ok_or(MeridioError::Overflow)?;

    // Settle state before moving money.
    let share = &mut ctx.accounts.share;
    share.status = ShareStatus::PickedUp;
    share.settled_at = now;

    transfer_from_vault(
        &ctx.accounts.collection,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.vendor_token,
        &ctx.accounts.token_program,
        to_vendor,
    )?;
    transfer_from_vault(
        &ctx.accounts.collection,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.organizer_token,
        &ctx.accounts.token_program,
        to_organizer,
    )?;

    let c = &mut ctx.accounts.collection;
    c.paid_count = c.paid_count.checked_sub(1).ok_or(MeridioError::Overflow)?;
    c.picked_count = c.picked_count.checked_add(1).ok_or(MeridioError::Overflow)?;

    emit!(SharePickedUp {
        collection: c.key(),
        buyer: ctx.accounts.buyer.key(),
        to_vendor,
        to_organizer,
    });
    Ok(())
}
