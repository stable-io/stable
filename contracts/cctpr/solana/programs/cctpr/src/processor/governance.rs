use anchor_lang::prelude::*;
use crate::state::{Config, ChainConfig, FeeAdjustment, FeeAdjustmentType};
use crate::error::CctprError;

// -- Initialize --

#[derive(Accounts)]
pub struct Initialize<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
    init,
    payer = payer,
    space = 8 + Config::INIT_SPACE,
    seeds = [Config::SEED_PREFIX],
    bump
  )]
  pub config: Account<'info, Config>,

  pub system_program: Program<'info, System>,
}

pub fn initialize(
  ctx: Context<Initialize>,
  owner: Pubkey,
  fee_adjuster: Pubkey,
  fee_recipient: Pubkey,
  offchain_quoter: [u8; 20],
) -> Result<()> {
  require!(owner != Pubkey::default(), CctprError::InvalidOwner);
  require!(fee_recipient != Pubkey::default(), CctprError::InvalidFeeRecipient);

  ctx.accounts.config.set_inner(Config {
    bump: ctx.bumps.config,
    owner,
    pending_owner: Pubkey::default(),
    fee_adjuster,
    fee_recipient,
    offchain_quoter,
  });

  Ok(())
}

// -- Ownership transfer --

#[derive(Accounts)]
pub struct OwnerContext<'info> {
  pub owner: Signer<'info>,

  #[account(mut, has_one = owner @ CctprError::NotAuthorized)]
  pub config: Account<'info, Config>,
}

pub fn submit_owner_transfer_request(
  ctx: Context<OwnerContext>,
  new_owner: Pubkey,
) -> Result<()> {
  ctx.accounts.config.pending_owner = new_owner;
  Ok(())
}

pub fn cancel_owner_transfer_request(ctx: Context<OwnerContext>) -> Result<()> {
  ctx.accounts.config.pending_owner = Pubkey::default();
  Ok(())
}

#[derive(Accounts)]
pub struct ConfirmOwnerTransfer<'info> {
  pub pending_owner: Signer<'info>,

  #[account(mut, has_one = pending_owner @ CctprError::InvalidPendingOwner)]
  pub config: Account<'info, Config>,
}

pub fn confirm_owner_transfer_request(ctx: Context<ConfirmOwnerTransfer>) -> Result<()> {
  ctx.accounts.config.owner = ctx.accounts.pending_owner.key();
  ctx.accounts.config.pending_owner = Pubkey::default();
  Ok(())
}

// -- EVM chain config --

#[derive(Accounts)]
#[instruction(domain_id: u8)]
pub struct RegisterChain<'info> {
  #[account(mut)]
  pub owner: Signer<'info>,

  #[account(has_one = owner @ CctprError::NotAuthorized)]
  pub config: Account<'info, Config>,

  #[account(
    init,
    payer = owner,
    space = 8 + ChainConfig::INIT_SPACE,
    seeds = [ChainConfig::SEED_PREFIX, domain_id.to_be_bytes().as_ref()],
    bump
  )]
  pub chain_config: Account<'info, ChainConfig>,

  pub system_program: Program<'info, System>,
}

pub fn register_chain(
  ctx: Context<RegisterChain>,
  domain_id: u8,
  chain_id: u16,
) -> Result<()> {
  ctx.accounts.chain_config.domain_id = domain_id;
  ctx.accounts.chain_config.chain_id = chain_id;
  Ok(())
}

#[derive(Accounts)]
pub struct DeregisterChain<'info> {
  #[account(mut)]
  pub owner: Signer<'info>,

  #[account(has_one = owner @ CctprError::NotAuthorized)]
  pub config: Account<'info, Config>,

  #[account(mut, close = owner)]
  pub chain_config: Account<'info, ChainConfig>,

  pub system_program: Program<'info, System>,
}

pub fn deregister_chain(_ctx: Context<DeregisterChain>) -> Result<()> {
  Ok(())
}

#[derive(Accounts)]
pub struct UpdateFeeAdjustment<'info> {
  #[account(constraint =
    signer.key() == config.owner ||
    signer.key() == config.fee_adjuster @ CctprError::NotAuthorized
  )]
  pub signer: Signer<'info>,

  pub config: Account<'info, Config>,

  #[account(mut)]
  pub chain_config: Account<'info, ChainConfig>,
}

pub fn update_fee_adjustment(
  ctx: Context<UpdateFeeAdjustment>,
  adjustment_type: FeeAdjustmentType,
  new_fee_adjustment: FeeAdjustment,
) -> Result<()> {
  ctx.accounts.chain_config.set_fee_adjustment(adjustment_type, new_fee_adjustment);
  Ok(())
}

// -- Role updates --

#[derive(Accounts)]
pub struct RoleUpdate<'info> {
  pub owner: Signer<'info>,

  #[account(mut, has_one = owner @ CctprError::NotAuthorized)]
  pub config: Account<'info, Config>,
}

pub fn update_fee_recipient(
  ctx: Context<RoleUpdate>,
  new_fee_recipient: Pubkey,
) -> Result<()> {
  require!(new_fee_recipient != Pubkey::default(), CctprError::InvalidFeeRecipient);
  ctx.accounts.config.fee_recipient = new_fee_recipient;
  Ok(())
}

pub fn update_fee_adjuster(
  ctx: Context<RoleUpdate>,
  new_fee_adjuster: Pubkey,
) -> Result<()> {
  ctx.accounts.config.fee_adjuster = new_fee_adjuster;
  Ok(())
}

pub fn update_offchain_quoter(
  ctx: Context<RoleUpdate>,
  new_offchain_quoter: [u8; 20],
) -> Result<()> {
  ctx.accounts.config.offchain_quoter = new_offchain_quoter;
  Ok(())
}
