use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::MeridioError, events::SharePaid, state::*};

#[derive(Accounts)]
pub struct PayShare<'info> {
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
        init,
        payer = buyer,
        space = 8 + Share::INIT_SPACE,
        seeds = [SHARE_SEED, collection.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub share: Account<'info, Share>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_pay_share(ctx: Context<PayShare>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let c = &ctx.accounts.collection;
    require!(c.status == CollectionStatus::Open, MeridioError::NotOpen);
    require!(now <= c.pay_by, MeridioError::PayByPassed);
    require!(c.paid_count < c.max_units, MeridioError::SoldOut);
    let amount = c.share_amount()?;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.buyer_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let share = &mut ctx.accounts.share;
    share.collection = ctx.accounts.collection.key();
    share.buyer = ctx.accounts.buyer.key();
    share.amount = amount;
    share.status = ShareStatus::Paid;
    share.paid_at = now;
    share.settled_at = 0;
    share.bump = ctx.bumps.share;

    let c = &mut ctx.accounts.collection;
    c.paid_count = c.paid_count.checked_add(1).ok_or(MeridioError::Overflow)?;

    emit!(SharePaid {
        collection: c.key(),
        buyer: share.buyer,
        amount,
    });
    Ok(())
}
