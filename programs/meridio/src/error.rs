use anchor_lang::prelude::*;

#[error_code]
pub enum MeridioError {
    #[msg("Unit price must be greater than zero")]
    ZeroPrice,
    #[msg("Fee is above the 10% cap")]
    FeeTooHigh,
    #[msg("Minimum buyers must be at least 1 and no more than the number of units")]
    BadBuyerLimits,
    #[msg("Deadlines must satisfy now < pay-by < pickup-by")]
    BadDeadlines,
    #[msg("Title is too long")]
    TitleTooLong,
    #[msg("This collection is not open")]
    NotOpen,
    #[msg("This collection is not locked")]
    NotLocked,
    #[msg("The pay-by time has passed")]
    PayByPassed,
    #[msg("The pay-by time has not passed yet")]
    PayByNotPassed,
    #[msg("The pickup-by time has passed")]
    PickupByPassed,
    #[msg("All units are taken")]
    SoldOut,
    #[msg("Not enough buyers have paid")]
    NotEnoughBuyers,
    #[msg("Only the organiser can do this now")]
    OrganizerOnly,
    #[msg("This share is not in the Paid state")]
    ShareNotPaid,
    #[msg("This share cannot be refunded yet")]
    RefundNotAllowed,
    #[msg("Some shares are still unsettled")]
    SharesOutstanding,
    #[msg("The vault still holds tokens")]
    VaultNotEmpty,
    #[msg("Arithmetic overflow")]
    Overflow,
}
