use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    error::MeridioError, events::ShareRefunded, instructions::vault::transfer_from_vault, state::*,
};

/// Anyone may crank a refund once it is due. The money can only go to the
/// token account owned by the buyer recorded in the share.
#[derive(Accounts)]
pub struct RefundShare<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub collection: Account<'info, Collection>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, has_one = collection)]
    pub share: Account<'info, Share>,
    #[account(
        mut,
        token::mint = mint,
        constraint = buyer_token.owner == share.buyer,
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn refund_due(c: &Collection, now: i64) -> bool {
    match c.status {
        CollectionStatus::Cancelled => true,
        // Never locked and pay-by passed without enough buyers.
        CollectionStatus::Open => now > c.pickup_by || (now > c.pay_by && c.paid_count < c.min_buyers),
        // Locked: whatever was not collected by pickup-by goes back.
        CollectionStatus::Locked => now > c.pickup_by,
    }
}

pub fn handle_refund_share(ctx: Context<RefundShare>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.share.status == ShareStatus::Paid, MeridioError::ShareNotPaid);
    require!(refund_due(&ctx.accounts.collection, now), MeridioError::RefundNotAllowed);

    let amount = ctx.accounts.share.amount;
    let share = &mut ctx.accounts.share;
    share.status = ShareStatus::Refunded;
    share.settled_at = now;
    let buyer = share.buyer;

    transfer_from_vault(
        &ctx.accounts.collection,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.buyer_token,
        &ctx.accounts.token_program,
        amount,
    )?;

    let c = &mut ctx.accounts.collection;
    c.paid_count = c.paid_count.checked_sub(1).ok_or(MeridioError::Overflow)?;
    c.refunded_count = c.refunded_count.checked_add(1).ok_or(MeridioError::Overflow)?;

    emit!(ShareRefunded {
        collection: c.key(),
        buyer,
        amount,
    });
    Ok(())
}
