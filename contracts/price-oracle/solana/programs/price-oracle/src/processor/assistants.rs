use crate::{error::PriceOracleError, state::AuthBadgeState};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(new_assistant: Pubkey)]
pub struct AddAssistant<'info> {
    /// The signer can be the owner or an admin.
    #[account(mut)]
    pub signer: Signer<'info>,

    /// Proof that the signer is authorized.
    #[account(constraint = &auth_badge.is_admin(&signer) @ PriceOracleError::OwnerOrAdminOnly)]
    pub auth_badge: Account<'info, AuthBadgeState>,

    #[account(
        init,
        payer = signer,
        space = 8 + AuthBadgeState::INIT_SPACE,
        seeds = [AuthBadgeState::SEED_PREFIX, new_assistant.to_bytes().as_ref()],
        bump
    )]
    pub assistant_auth_badge: Account<'info, AuthBadgeState>,

    pub system_program: Program<'info, System>,
}

pub fn add_assistant_role(ctx: Context<AddAssistant>, new_assistant: Pubkey) -> Result<()> {
    ctx.accounts.assistant_auth_badge.set_inner(AuthBadgeState {
        address: new_assistant,
        is_admin: false,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveAssistant<'info> {
    /// The signer can be the owner or an admin.
    pub signer: Signer<'info>,

    /// Proof that the signer is authorized.
    #[account(constraint = &auth_badge.is_admin(&signer) @ PriceOracleError::OwnerOrAdminOnly)]
    pub auth_badge: Account<'info, AuthBadgeState>,

    #[account(
        mut,
        close = signer,
        constraint = auth_badge_to_be_removed.is_admin == false @ PriceOracleError::AssistantDeletionOnly,
    )]
    pub auth_badge_to_be_removed: Account<'info, AuthBadgeState>,
}

pub fn remove_assistant_role(_ctx: Context<RemoveAssistant>) -> Result<()> {
    Ok(())
}
