use anchor_lang::prelude::*;

use crate::{cctp_cpi::reclaim, state::Config};

#[derive(Accounts)]
pub struct ReclaimRent<'info> {
  #[account(mut)]
  pub config: Account<'info, Config>,

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
  attestation: [u8; 65],
  destination_message: Vec<u8>, // length > 0 ⇒ v2, otherwise ⇒ v1
) -> Result<()> {
  let bump = [ctx.accounts.config.bump];
  let signer_seeds: &[&[u8]] = &[Config::SEED_PREFIX, &bump];
  let seeds = [signer_seeds];

  let ctx = anchor_lang::context::CpiContext::new_with_signer(
    ctx.accounts.message_transmitter_program.to_account_info(),
    reclaim::ReclaimEventAccount {
      payee: ctx.accounts.config.to_account_info(),
      message_transmitter_config: ctx.accounts.message_transmitter_config.to_account_info(),
      message_sent_event_data: ctx.accounts.message_sent_event_data.to_account_info(),
    },
    &seeds,
  );

  if destination_message.len() > 0 {
    let params = reclaim::v2::ReclaimEventAccountParams { attestation, destination_message };
    reclaim::v2::reclaim_event_account(ctx, &params)
  } else {
    let params = reclaim::v1::ReclaimEventAccountParams { attestation };
    reclaim::v1::reclaim_event_account(ctx, &params)
  }
}

// ----

#[derive(Accounts)]
pub struct TransferSurplusSol<'info> {
  #[account(mut, has_one = fee_recipient)]
  pub config: Account<'info, Config>,

  /// CHECK: leave Britney alone
  #[account(mut)]
  pub fee_recipient: AccountInfo<'info>,
}

pub fn transfer_surplus_sol(ctx: Context<TransferSurplusSol>) -> Result<()> {
  let config_info = ctx.accounts.config.to_account_info();
  let fee_recipient_info = ctx.accounts.fee_recipient.to_account_info();

  let current_balance = **config_info.lamports.borrow();
  let rent_exempt_balance = Rent::get()?.minimum_balance(config_info.data_len());
  let surplus = current_balance.saturating_sub(rent_exempt_balance);

  **config_info.try_borrow_mut_lamports()?        -= surplus;
  **fee_recipient_info.try_borrow_mut_lamports()? += surplus;

  Ok(())
}
