use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount};

use crate::{constants::*, error::MeridioError, state::*};

/// Once every share is settled and the vault is empty, the organiser
/// reclaims the rent of the vault and the collection.
#[derive(Accounts)]
pub struct CloseCollection<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        mut,
        close = organizer,
        has_one = organizer @ MeridioError::OrganizerOnly,
        has_one = vault,
    )]
    pub collection: Account<'info, Collection>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_close_collection(ctx: Context<CloseCollection>) -> Result<()> {
    let c = &ctx.accounts.collection;
    require!(c.paid_count == 0, MeridioError::SharesOutstanding);
    require!(ctx.accounts.vault.amount == 0, MeridioError::VaultNotEmpty);

    let id_bytes = c.collection_id.to_le_bytes();
    let bump = [c.bump];
    let seeds: &[&[u8]] = &[COLLECTION_SEED, c.organizer.as_ref(), &id_bytes, &bump];
    let signer: &[&[&[u8]]] = &[seeds];
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.organizer.to_account_info(),
            authority: ctx.accounts.collection.to_account_info(),
        },
        signer,
    ))
}
