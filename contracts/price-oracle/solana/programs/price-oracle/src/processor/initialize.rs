use crate::{
    error::PriceOracleError,
    state::{AuthBadgeState, PriceOracleConfigState},
    utils::DrainAccount,
};
use anchor_lang::{
    prelude::*,
    solana_program::{bpf_loader_upgradeable, program::invoke},
};
use std::ops::DerefMut;

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Since we are passing on the upgrade authority, the original deployer is the only one
    /// who can initialize the program.
    #[account(mut)]
    pub deployer: Signer<'info>,

    /// CHECK: just an account.
    /// Owner of the program as set in the [`OwnerConfig`] account.
    pub owner: UncheckedAccount<'info>,

    #[account(
        init,
        payer = deployer,
        space = 8 + AuthBadgeState::INIT_SPACE,
        seeds = [AuthBadgeState::SEED_PREFIX, owner.key.to_bytes().as_ref()],
        bump
    )]
    pub owner_badge: Account<'info, AuthBadgeState>,

    /// Owner Config account. This program requires that the `owner` specified
    /// in the context equals the pubkey specified in this account. Mutable.
    /// By using a PDA we guarantee that initialization can only be done once.
    #[account(
        init,
        payer = deployer,
        space = 8 + PriceOracleConfigState::INIT_SPACE,
        seeds = [PriceOracleConfigState::SEED_PREFIX],
        bump
    )]
    pub config: Account<'info, PriceOracleConfigState>,

    #[account(
        mut,
        seeds = [crate::ID.as_ref()],
        bump,
        seeds::program = bpf_loader_upgradeable::ID,
    )]
    program_data: Account<'info, ProgramData>,

    /// CHECK: this is the BPF Loader program address.
    #[account(address = bpf_loader_upgradeable::ID)]
    pub bpf_loader_upgradeable: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, Initialize<'info>>,
    admins: Vec<Pubkey>,
    assistants: Vec<Pubkey>,
) -> Result<()> {
    //We only update the upgrade authority if the program wasn't deployed by the designated owner
    if Some(ctx.accounts.owner.key()) != ctx.accounts.program_data.upgrade_authority_address {
        //This call fails for anyone but the deployer who must be the current update authority.
        invoke(
            &bpf_loader_upgradeable::set_upgrade_authority(
                &ctx.program_id,
                &ctx.accounts.deployer.key(),
                Some(&ctx.accounts.owner.key()),
            ),
            &[
                ctx.accounts.program_data.to_account_info(),
                ctx.accounts.deployer.to_account_info(),
                ctx.accounts.owner.to_account_info(),
            ],
        )?;
    }

    ctx.accounts.config.set_inner(PriceOracleConfigState {
        owner: ctx.accounts.owner.key(),
        pending_owner: None,
        sol_price: 0,
    });

    ctx.accounts.owner_badge.set_inner(AuthBadgeState {
        address: ctx.accounts.owner.key(),
        is_admin: true,
    });

    require_eq!(
        admins.len() + assistants.len(),
        ctx.remaining_accounts.len(),
        PriceOracleError::AdminsAndAssistantsCountMismatch
    );

    let admins = admins.into_iter().map(|key| (key, true));
    let assistants = assistants.into_iter().map(|key| (key, false));

    for ((address, is_admin), badge_acc_info) in
        admins.chain(assistants).zip(ctx.remaining_accounts)
    {
        let (_pubkey, bump) = Pubkey::find_program_address(
            &[AuthBadgeState::SEED_PREFIX, address.to_bytes().as_ref()],
            ctx.program_id,
        );

        // Before calling `create_account`, we need to verify that the account
        // has an empty balance, otherwise the instruction would fail:
        DrainAccount {
            system_program: ctx.accounts.system_program.to_account_info(),
            account: badge_acc_info.clone(),
            recipient: ctx.accounts.deployer.to_account_info(),
        }
        .run_with_seeds(&[
            AuthBadgeState::SEED_PREFIX,
            address.to_bytes().as_ref(),
            &[bump],
        ])?;

        anchor_lang::system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::CreateAccount {
                    from: ctx.accounts.deployer.to_account_info(),
                    to: badge_acc_info.clone(),
                },
                &[&[
                    AuthBadgeState::SEED_PREFIX,
                    address.to_bytes().as_ref(),
                    &[bump],
                ]],
            ),
            Rent::get()?.minimum_balance(8 + AuthBadgeState::INIT_SPACE),
            (8 + AuthBadgeState::INIT_SPACE) as u64,
            ctx.program_id,
        )?;

        AuthBadgeState::try_serialize(
            &AuthBadgeState { address, is_admin },
            badge_acc_info.try_borrow_mut_data()?.deref_mut(),
        )?;
    }

    Ok(())
}
