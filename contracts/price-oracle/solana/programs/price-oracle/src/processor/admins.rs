use crate::{
    error::PriceOracleError,
    state::{AuthBadgeState, PriceOracleConfigState},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(
    new_admin: Pubkey,
)]
pub struct AddAdmin<'info> {
    /// The signer must be the owner.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Program Config account. This program requires that the [`owner`] specified
    /// in the context equals the owner role stored in the config.
    #[account(has_one = owner @ PriceOracleError::OwnerOnly)]
    pub config: Account<'info, PriceOracleConfigState>,

    #[account(
        init,
        payer = owner,
        space = 8 + AuthBadgeState::INIT_SPACE,
        seeds = [AuthBadgeState::SEED_PREFIX, new_admin.to_bytes().as_ref()],
        bump
    )]
    pub admin_auth_badge: Account<'info, AuthBadgeState>,

    pub system_program: Program<'info, System>,
}

pub fn add_admin_role(ctx: Context<AddAdmin>, new_admin: Pubkey) -> Result<()> {
    ctx.accounts.admin_auth_badge.set_inner(AuthBadgeState {
        address: new_admin,
        is_admin: true,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveAdmin<'info> {
    /// The signer can be the owner or an admin.
    pub signer: Signer<'info>,

    /// Proof that the signer is authorized.
    #[account(constraint = &auth_badge.is_admin(&signer) @ PriceOracleError::OwnerOrAdminOnly)]
    pub auth_badge: Account<'info, AuthBadgeState>,

    /// Program Config account. This program requires that the [`owner`] specified
    /// in the context equals the owner role stored in the config.
    pub config: Account<'info, PriceOracleConfigState>,

    #[account(
        mut,
        close = signer,
        constraint = (
            auth_badge_to_be_removed.address != config.owner
        ) @ PriceOracleError::OwnerDeletionForbidden,
    )]
    pub auth_badge_to_be_removed: Account<'info, AuthBadgeState>,
}

pub fn remove_admin_role(_ctx: Context<RemoveAdmin>) -> Result<()> {
    Ok(())
}
