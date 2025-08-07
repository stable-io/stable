use anchor_lang::{prelude::*, solana_program};
use super::common;

// sha256("global:deposit_for_burn") = 0xd73c3d2e723780b0... ⇒
const DISCRIMINATOR_DEPOSIT_FOR_BURN: [u8; 8] = [215, 60, 61, 46, 114, 55, 128, 176];

// sha256("global:deposit_for_burn_with_hook") = 0x6ff53e83cc6cdf9b... ⇒
const DISCRIMINATOR_DEPOSIT_FOR_BURN_WITH_HOOK: [u8; 8] = [111, 245, 62, 131, 204, 108, 223, 155];

pub mod v1 {
  //see:
  // * https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/token-messenger-minter/src/token_messenger/instructions/deposit_for_burn.rs
  use super::*;

  //    8 discriminator
  //+  32 rent payer
  //+   4 vec.len
  //+ 116 Message Header
  //+ 132 Burn Message Length
  //  ---
  //  292 bytes (doesn't include additional 128 bytes of account overhead)
  //
  //see:
  // * account struct: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/message-transmitter/src/events.rs#L49-L70
  // * message header: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/message-transmitter/src/message.rs#L43
  // * burn message: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/token-messenger-minter/src/token_messenger/burn_message.rs#L39
  pub const MESSAGE_SENT_EVENT_DATA_SIZE: usize = 292;
  
  pub struct Deposit<'info> {
    //#[account(signer)]
    pub burn_token_owner: AccountInfo<'info>,
    //#[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    pub token_messenger_minter_sender_authority: AccountInfo<'info>,
    //#[account(mut)]
    pub burn_token: AccountInfo<'info>,
    //#[account(mut)]
    pub message_transmitter_config: AccountInfo<'info>,
    pub token_messenger_config: AccountInfo<'info>,
    pub remote_token_messenger_config: AccountInfo<'info>,
    pub token_minter_config: AccountInfo<'info>,
    //#[account(mut)]
    pub local_token: AccountInfo<'info>,
    //#[account(mut)]
    pub burn_token_mint: AccountInfo<'info>,
    //#[account(mut, signer)]
    pub message_sent_event_data: AccountInfo<'info>,
    pub message_transmitter_program: AccountInfo<'info>,
    pub token_messenger_minter_program: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    //CCTP Token Messenger Minter program uses Anchor's event_cpi macro
    //see: https://github.com/solana-foundation/anchor/blob/3dd2386d89123b4639995957ba67c35108f96ae5/lang/attribute/event/src/lib.rs#L197-L227
    pub event_authority: AccountInfo<'info>,
  }

  impl<'info> ToAccountMetas for Deposit<'info> {
    fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
      vec![
        AccountMeta::new_readonly(self.burn_token_owner.key(), true),
        AccountMeta::new(self.payer.key(), true),
        AccountMeta::new_readonly(self.token_messenger_minter_sender_authority.key(), false),
        AccountMeta::new(self.burn_token.key(), false),
        AccountMeta::new(self.message_transmitter_config.key(), false),
        AccountMeta::new_readonly(self.token_messenger_config.key(), false),
        AccountMeta::new_readonly(self.remote_token_messenger_config.key(), false),
        AccountMeta::new_readonly(self.token_minter_config.key(), false),
        AccountMeta::new(self.local_token.key(), false),
        AccountMeta::new(self.burn_token_mint.key(), false),
        AccountMeta::new(self.message_sent_event_data.key(), true),
        AccountMeta::new_readonly(self.message_transmitter_program.key(), false),
        AccountMeta::new_readonly(self.token_messenger_minter_program.key(), false),
        AccountMeta::new_readonly(self.token_program.key(), false),
        AccountMeta::new_readonly(self.system_program.key(), false),
        AccountMeta::new_readonly(self.event_authority.key(), false), //event_cpi
        AccountMeta::new_readonly(self.token_messenger_minter_program.key(), false), //event_cpi
      ]
    }
  }

  impl<'info> ToAccountInfos<'info> for Deposit<'info> {
    fn to_account_infos(&self) -> Vec<AccountInfo<'info>> {
      vec![
        self.burn_token_owner.clone(),
        self.payer.clone(),
        self.token_messenger_minter_sender_authority.clone(),
        self.burn_token.clone(),
        self.message_transmitter_config.clone(),
        self.token_messenger_config.clone(),
        self.remote_token_messenger_config.clone(),
        self.token_minter_config.clone(),
        self.local_token.clone(),
        self.burn_token_mint.clone(),
        self.message_sent_event_data.clone(),
        self.message_transmitter_program.clone(),
        self.token_messenger_minter_program.clone(),
        self.token_program.clone(),
        self.system_program.clone(),
        self.event_authority.clone(),
        self.token_messenger_minter_program.clone(),
      ]
    }
  }

  #[repr(C)]
  #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
  pub struct DepositForBurnParams {
    pub amount: u64,
    pub destination_domain: u32,
    pub mint_recipient: [u8; 32],
  }

  pub fn deposit_for_burn<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, Deposit<'info>>,
    params: DepositForBurnParams,
  ) -> Result<u64> {
    invoke_deposit(
      common::v1::TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      ctx,
      DISCRIMINATOR_DEPOSIT_FOR_BURN,
      params,
    )?;

    // Return data contains nonce
    let (_, return_data) = solana_program::program::get_return_data().unwrap();
    let nonce = u64::from_le_bytes(return_data.try_into().unwrap());
    Ok(nonce)
  }
}

pub mod v2 {
  //see:
  // * https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/instructions/deposit_for_burn.rs

  use super::*;

  //    8 discriminator
  //+  32 rent payer
  //+   8 timestamp
  //+   4 vec.len
  //+ 148 Message Header
  //+ 228 Burn Message Length
  //  ---
  //  428 bytes (doesn't include additional 128 bytes of account overhead)
  //
  //see:
  // * account struct: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/v2/message-transmitter-v2/src/events.rs#L49-L71
  // * message header: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/v2/message-transmitter-v2/src/message.rs#L45
  // * burn message: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/burn_message.rs#L41
  pub const MESSAGE_SENT_EVENT_DATA_SIZE: usize = 428;

  pub struct Deposit<'info> {
    //#[account(signer)]
    pub burn_token_owner: AccountInfo<'info>,
    //#[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    pub token_messenger_minter_sender_authority: AccountInfo<'info>,
    //#[account(mut)]
    pub burn_token: AccountInfo<'info>,
    /// If account exists, then owner is denylisted.
    pub denylisted: AccountInfo<'info>,
    //#[account(mut)]
    pub message_transmitter_config: AccountInfo<'info>,
    pub token_messenger_config: AccountInfo<'info>,
    pub remote_token_messenger_config: AccountInfo<'info>,
    pub token_minter_config: AccountInfo<'info>,
    //#[account(mut)]
    pub local_token: AccountInfo<'info>,
    //#[account(mut)]
    pub burn_token_mint: AccountInfo<'info>,
    //#[account(mut, signer)]
    pub message_sent_event_data: AccountInfo<'info>,
    pub message_transmitter_program: AccountInfo<'info>,
    pub token_messenger_minter_program: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    //CCTP Token Messenger Minter program uses Anchor's event_cpi macro
    pub event_authority: AccountInfo<'info>,
  }
  
  impl<'info> ToAccountMetas for Deposit<'info> {
    fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
      vec![
        AccountMeta::new_readonly(self.burn_token_owner.key(), true),
        AccountMeta::new(self.payer.key(), true),
        AccountMeta::new_readonly(self.token_messenger_minter_sender_authority.key(), false),
        AccountMeta::new(self.burn_token.key(), false),
        AccountMeta::new_readonly(self.denylisted.key(), false),
        AccountMeta::new(self.message_transmitter_config.key(), false),
        AccountMeta::new_readonly(self.token_messenger_config.key(), false),
        AccountMeta::new_readonly(self.remote_token_messenger_config.key(), false),
        AccountMeta::new_readonly(self.token_minter_config.key(), false),
        AccountMeta::new(self.local_token.key(), false),
        AccountMeta::new(self.burn_token_mint.key(), false),
        AccountMeta::new(self.message_sent_event_data.key(), true),
        AccountMeta::new_readonly(self.message_transmitter_program.key(), false),
        AccountMeta::new_readonly(self.token_messenger_minter_program.key(), false),
        AccountMeta::new_readonly(self.token_program.key(), false),
        AccountMeta::new_readonly(self.system_program.key(), false),
        AccountMeta::new_readonly(self.event_authority.key(), false), //event_cpi
        AccountMeta::new_readonly(self.token_messenger_minter_program.key(), false), //event_cpi
      ]
    }
  }
  
  impl<'info> ToAccountInfos<'info> for Deposit<'info> {
    fn to_account_infos(&self) -> Vec<AccountInfo<'info>> {
      vec![
        self.burn_token_owner.clone(),
        self.payer.clone(),
        self.token_messenger_minter_sender_authority.clone(),
        self.burn_token.clone(),
        self.denylisted.clone(),
        self.message_transmitter_config.clone(),
        self.token_messenger_config.clone(),
        self.remote_token_messenger_config.clone(),
        self.token_minter_config.clone(),
        self.local_token.clone(),
        self.burn_token_mint.clone(),
        self.message_sent_event_data.clone(),
        self.message_transmitter_program.clone(),
        self.token_messenger_minter_program.clone(),
        self.token_program.clone(),
        self.system_program.clone(),
        self.event_authority.clone(),
        self.token_messenger_minter_program.clone(),
      ]
    }
  }

  #[repr(C)]
  #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
  pub struct DepositForBurnParams {
    pub amount: u64,
    pub destination_domain: u32,
    pub mint_recipient: [u8; 32],
    pub destination_caller: [u8; 32], // For no destination caller, use [0; 32]
    pub max_fee: u64,
    pub min_finality_threshold: u32,
  }

  #[repr(C)]
  #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
  pub struct DepositForBurnWithHookParams {
    pub shared: DepositForBurnParams,
    pub hook_data: Vec<u8>,
  }

  pub fn deposit_for_burn<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, Deposit<'info>>,
    params: DepositForBurnParams,
  ) -> Result<()> {
    invoke_deposit(
      common::v2::TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      ctx,
      DISCRIMINATOR_DEPOSIT_FOR_BURN,
      params,
    )
  }

  pub fn deposit_for_burn_with_hook<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, Deposit<'info>>,
    params: DepositForBurnWithHookParams,
  ) -> Result<()> {
    invoke_deposit(
      common::v2::TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      ctx,
      DISCRIMINATOR_DEPOSIT_FOR_BURN_WITH_HOOK,
      params,
    )
  }
}

fn invoke_deposit<'info, A, P>(
  program_id: Pubkey,
  ctx: CpiContext<'_, '_, '_, 'info, A>,
  ix_discriminator: [u8; 8],
  params: P,
) -> Result<()>
where
  A: ToAccountMetas + ToAccountInfos<'info>,
  P: AnchorSerialize,
{
  solana_program::program::invoke_signed(
    &solana_program::instruction::Instruction {
      program_id,
      accounts: ctx.to_account_metas(None),
      data: (ix_discriminator, params).try_to_vec()?,
    },
    &ctx.to_account_infos(),
    ctx.signer_seeds,
  )
  .map_err(Into::into)
}
