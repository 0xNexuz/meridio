use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*, error::MeridioError, events::ShareCancelled, instructions::vault::transfer_from_vault,
    state::*,
};

/// A buyer changes their mind while the collection is still open.
#[derive(Accounts)]
pub struct CancelShare<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub collection: Account<'info, Collection>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = buyer,
        seeds = [SHARE_SEED, collection.key().as_ref(), buyer.key().as_ref()],
        bump = share.bump,
        has_one = buyer,
        has_one = collection,
    )]
    pub share: Account<'info, Share>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_cancel_share(ctx: Context<CancelShare>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let c = &ctx.accounts.collection;
    require!(c.status == CollectionStatus::Open, MeridioError::NotOpen);
    require!(now <= c.pay_by, MeridioError::PayByPassed);
    require!(ctx.accounts.share.status == ShareStatus::Paid, MeridioError::ShareNotPaid);
    let amount = ctx.accounts.share.amount;

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

    emit!(ShareCancelled {
        collection: c.key(),
        buyer: ctx.accounts.buyer.key(),
        amount,
    });
    Ok(())
}
