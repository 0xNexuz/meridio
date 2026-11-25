//! Meridio: a class pools money for one purchase. Each student's share sits in
//! a program-owned vault and moves only when that student collects the item
//! (paid to the vendor) or when it is refunded to that same student.
//! The organiser (course rep) never holds the money.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2LfiJacHJyjhZG4Ce7SNkrv44vyeZGA1PjnxVAvGERxT");

#[program]
pub mod meridio {
    use super::*;

    pub fn create_collection(ctx: Context<CreateCollection>, args: CreateCollectionArgs) -> Result<()> {
        instructions::create_collection::handle_create_collection(ctx, args)
    }

    pub fn pay_share(ctx: Context<PayShare>) -> Result<()> {
        instructions::pay_share::handle_pay_share(ctx)
    }

    pub fn cancel_share(ctx: Context<CancelShare>) -> Result<()> {
        instructions::cancel_share::handle_cancel_share(ctx)
    }

    pub fn lock(ctx: Context<Lock>) -> Result<()> {
        instructions::lock::handle_lock(ctx)
    }

    pub fn cancel_collection(ctx: Context<CancelCollection>) -> Result<()> {
        instructions::cancel_collection::handle_cancel_collection(ctx)
    }

    pub fn confirm_pickup(ctx: Context<ConfirmPickup>) -> Result<()> {
        instructions::confirm_pickup::handle_confirm_pickup(ctx)
    }

    pub fn refund_share(ctx: Context<RefundShare>) -> Result<()> {
        instructions::refund_share::handle_refund_share(ctx)
    }

    pub fn close_collection(ctx: Context<CloseCollection>) -> Result<()> {
        instructions::close_collection::handle_close_collection(ctx)
    }
}
