use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, state::Collection};

/// Move tokens out of the vault, signed by the Collection PDA.
/// Every caller chooses the destination from validated accounts; this helper
/// is the only place the PDA signs a transfer.
pub fn transfer_from_vault<'info>(
    collection: &Account<'info, Collection>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let id_bytes = collection.collection_id.to_le_bytes();
    let bump = [collection.bump];
    let seeds: &[&[u8]] = &[COLLECTION_SEED, collection.organizer.as_ref(), &id_bytes, &bump];
    let signer: &[&[&[u8]]] = &[seeds];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: collection.to_account_info(),
            },
            signer,
        ),
        amount,
        mint.decimals,
    )
}
