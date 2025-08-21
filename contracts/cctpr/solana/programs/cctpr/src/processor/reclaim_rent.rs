use anchor_lang::{prelude::*, system_program};

use crate::{cctp_cpi::reclaim, state::Config};

#[derive(Accounts)]
pub struct ReclaimRent<'info> {
  pub config: Account<'info, Config>,

  /// CHECK: leave Britney alone
  #[account(mut)]
  pub rent_custodian: AccountInfo<'info>,

  /// CHECK: v1 or v2 `MessageTransmitter` config account
  #[account(mut)]
  pub message_transmitter_config: UncheckedAccount<'info>,

  /// CHECK: closed by the downstream CPI
  #[account(mut)]
  pub message_sent_event_data: UncheckedAccount<'info>,

  /// CHECK: Either v1 or v2 MessageTransmitter program
  pub message_transmitter_program: UncheckedAccount<'info>,
}

pub fn reclaim_rent(
  ctx: Context<ReclaimRent>,
  attestation: Vec<u8>,
  destination_message: Vec<u8>, // length > 0 ⇒ v2, otherwise ⇒ v1
) -> Result<()> {
  let bump = [ctx.accounts.config.rent_bump];
  let signer_seeds: &[&[u8]] = &[Config::RENT_SEED_PREFIX, &bump];
  let seeds: &[&[&[u8]]] = &[signer_seeds];

  let ctx = anchor_lang::context::CpiContext::new_with_signer(
    ctx.accounts.message_transmitter_program                             .to_account_info(),
    reclaim::ReclaimEventAccount {
      payee: ctx.accounts.rent_custodian                                 .to_account_info(),
      message_transmitter_config: ctx.accounts.message_transmitter_config.to_account_info(),
      message_sent_event_data: ctx.accounts.message_sent_event_data      .to_account_info(),
    },
    &seeds,
  );

  if destination_message.len() == 0 {
    let params = reclaim::v1::ReclaimEventAccountParams { attestation };
    reclaim::v1::reclaim_event_account(ctx, &params)
  } else {
    let params = reclaim::v2::ReclaimEventAccountParams { attestation, destination_message };
    reclaim::v2::reclaim_event_account(ctx, &params)
  }
}

// ----

#[derive(Accounts)]
pub struct TransferSurplusSol<'info> {
  #[account(has_one = fee_recipient)]
  pub config: Account<'info, Config>,

  /// CHECK: leave Britney alone
  #[account(mut)]
  pub rent_custodian: AccountInfo<'info>,

  /// CHECK: leave Britney alone
  #[account(mut)]
  pub fee_recipient: AccountInfo<'info>,

  pub system_program: Program<'info, System>,
}

pub fn transfer_surplus_sol(ctx: Context<TransferSurplusSol>) -> Result<()> {
  let bump = [ctx.accounts.config.rent_bump];
  let signer_seeds: &[&[u8]] = &[Config::RENT_SEED_PREFIX, &bump];
  let seeds: &[&[&[u8]]] = &[signer_seeds];

  system_program::transfer(
    CpiContext::new_with_signer(
      ctx.accounts.system_program        .to_account_info(),
      system_program::Transfer {
        from: ctx.accounts.rent_custodian.to_account_info(),
        to:   ctx.accounts.fee_recipient .to_account_info(),
      },
      &seeds,
    ),
    ctx.accounts.rent_custodian.to_account_info().lamports(),
  )
}
