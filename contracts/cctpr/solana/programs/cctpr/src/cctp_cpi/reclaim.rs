use anchor_lang::{prelude::*, solana_program};
use super::common;

pub mod v1 {
  use super::*;

  #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
  pub struct ReclaimEventAccountParams {
    pub attestation: Vec<u8>,
  }

  pub fn reclaim_event_account<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, ReclaimEventAccount<'info>>,
    params: &ReclaimEventAccountParams,
  ) -> Result<()> {
    invoke_reclaim(
      common::v1::MESSAGE_TRANSMITTER_PROGRAM_ID,
      ctx,
      params,
    )
  }
}

pub mod v2 {
  use super::*;

  #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
  pub struct ReclaimEventAccountParams {
    pub attestation: Vec<u8>,
    pub destination_message: Vec<u8>,
  }

  pub fn reclaim_event_account<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, ReclaimEventAccount<'info>>,
    params: &ReclaimEventAccountParams,
  ) -> Result<()> {
    invoke_reclaim(
      common::v2::MESSAGE_TRANSMITTER_PROGRAM_ID,
      ctx,
      params,
    )
  }
}

pub struct ReclaimEventAccount<'info> {
  //#[account(mut, signer)]
  pub payee: AccountInfo<'info>,
  //#[account(mut)]
  pub message_transmitter_config: AccountInfo<'info>,
  //#[account(mut)]
  pub message_sent_event_data: AccountInfo<'info>,
}

impl<'info> ToAccountMetas for ReclaimEventAccount<'info> {
  fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
    vec![
      AccountMeta::new(self.payee.key(), true),
      AccountMeta::new(self.message_transmitter_config.key(), false),
      AccountMeta::new(self.message_sent_event_data.key(), false),
    ]
  }
}

impl<'info> ToAccountInfos<'info> for ReclaimEventAccount<'info> {
  fn to_account_infos(&self) -> Vec<AccountInfo<'info>> {
    vec![
      self.payee.clone(),
      self.message_transmitter_config.clone(),
      self.message_sent_event_data.clone(),
    ]
  }
}

// sha256("global:reclaim_event_account") = 0x5ec6b49f83ec0fae... ⇒
const IX_DISCRIMINATOR: [u8; 8] = [94, 198, 180, 159, 131, 236, 15, 174];

fn invoke_reclaim<'info, P>(
  program_id: Pubkey,
  ctx: CpiContext<'_, '_, '_, 'info, ReclaimEventAccount<'info>>,
  params: &P,
) -> Result<()>
  where P: AnchorSerialize,
{
  solana_program::program::invoke_signed(
    &solana_program::instruction::Instruction {
      program_id,
      accounts: ctx.to_account_metas(None),
      data: (IX_DISCRIMINATOR, params).try_to_vec()?,
    },
    &ctx.to_account_infos(),
    ctx.signer_seeds,
  )
  .map_err(Into::into)
}
