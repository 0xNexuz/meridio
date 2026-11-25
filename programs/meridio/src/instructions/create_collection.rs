use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::MeridioError, events::CollectionCreated, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateCollectionArgs {
    pub collection_id: u64,
    pub title: String,
    pub vendor: Pubkey,
    pub station: Pubkey,
    pub unit_price: u64,
    pub fee_per_unit: u64,
    pub min_buyers: u32,
    pub max_units: u32,
    pub pay_by: i64,
    pub pickup_by: i64,
}

#[derive(Accounts)]
#[instruction(args: CreateCollectionArgs)]
pub struct CreateCollection<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Collection::INIT_SPACE,
        seeds = [COLLECTION_SEED, organizer.key().as_ref(), &args.collection_id.to_le_bytes()],
        bump
    )]
    pub collection: Account<'info, Collection>,
    #[account(
        init,
        payer = organizer,
        seeds = [VAULT_SEED, collection.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = collection,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_collection(ctx: Context<CreateCollection>, args: CreateCollectionArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(args.unit_price > 0, MeridioError::ZeroPrice);
    // fee <= price / 10, written without division so nothing rounds.
    let fee_x10 = args
        .fee_per_unit
        .checked_mul(MAX_FEE_DIVISOR)
        .ok_or(MeridioError::Overflow)?;
    require!(fee_x10 <= args.unit_price, MeridioError::FeeTooHigh);
    require!(
        args.min_buyers >= 1 && args.min_buyers <= args.max_units,
        MeridioError::BadBuyerLimits
    );
    require!(now < args.pay_by && args.pay_by < args.pickup_by, MeridioError::BadDeadlines);
    require!(args.title.len() <= MAX_TITLE_LEN as usize, MeridioError::TitleTooLong);
    // The share amount must not overflow.
    args.unit_price
        .checked_add(args.fee_per_unit)
        .ok_or(MeridioError::Overflow)?;

    let c = &mut ctx.accounts.collection;
    c.organizer = ctx.accounts.organizer.key();
    c.vendor = args.vendor;
    c.station = args.station;
    c.mint = ctx.accounts.mint.key();
    c.vault = ctx.accounts.vault.key();
    c.collection_id = args.collection_id;
    c.title = args.title;
    c.unit_price = args.unit_price;
    c.fee_per_unit = args.fee_per_unit;
    c.min_buyers = args.min_buyers;
    c.max_units = args.max_units;
    c.pay_by = args.pay_by;
    c.pickup_by = args.pickup_by;
    c.status = CollectionStatus::Open;
    c.paid_count = 0;
    c.picked_count = 0;
    c.refunded_count = 0;
    c.bump = ctx.bumps.collection;
    c.vault_bump = ctx.bumps.vault;

    emit!(CollectionCreated {
        collection: c.key(),
        organizer: c.organizer,
        vendor: c.vendor,
        unit_price: c.unit_price,
        fee_per_unit: c.fee_per_unit,
        max_units: c.max_units,
    });
    Ok(())
}
