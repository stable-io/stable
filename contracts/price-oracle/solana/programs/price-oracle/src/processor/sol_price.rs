use crate::{
    error::PriceOracleError,
    state::{AuthBadgeState, PriceOracleConfigState},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateSolPrice<'info> {
    /// Any authorized account: owner, admin or assistant.
    pub signer: Signer<'info>,

    /// Proof that the signer is authorized.
    #[account(constraint = &auth_badge.is_assistant(&signer) @ PriceOracleError::AuthorizedOnly)]
    pub auth_badge: Account<'info, AuthBadgeState>,

    /// This program Config account. This program requires that the [`signer`]
    /// specified in the context equals a pubkey specified in this account.
    /// Mutable, because we will update the `sol_price` field.
    #[account(mut)]
    pub config: Account<'info, PriceOracleConfigState>,
}

pub fn update_sol_price(ctx: Context<UpdateSolPrice>, new_sol_price: u64) -> Result<()> {
    ctx.accounts.config.sol_price = new_sol_price;

    Ok(())
}
