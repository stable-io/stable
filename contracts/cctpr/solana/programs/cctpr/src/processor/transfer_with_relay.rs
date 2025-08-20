use anchor_lang::{
  prelude::*,
  system_program,
  solana_program::{keccak::hash, secp256k1_recover::secp256k1_recover}
};
use anchor_spl::{
  token,
  token::{TokenAccount, Token}
};
use price_oracle::{
  int::Int,
  utils::int_to_u64,
  state::{PricesState, PriceOracleConfigState, TargetChainsConfig},
};
use crate::{
  error::CctprError,
  state::{Config, ChainConfig, FeeAdjustmentType},
  cctp_cpi::deposit,
};

const DOMAIN_ID_SOLANA:     u8 = 5;
const DOMAIN_ID_AVALANCHE:  u8 = 1;
const CHAIN_ID_AVALANCHE:  u16 = 6;

//taken from EVM contract
const AVAX_HOP_GAS_COST:              u32 = 281_200;

const EVM_GAS_DROPOFF_GAS_COST:       u32 =  22_000;
const EVM_V1_BILLED_SIZE:             u32 =     664;
const EVM_V1_GAS_COST:                u32 = 165_000;
const EVM_V2_BILLED_SIZE:             u32 =     793;
const EVM_V2_GAS_COST:                u32 = 175_000;

const SUI_GAS_DROPOFF_STORAGE_BYTES:  u32 =     260;
const SUI_GAS_DROPOFF_COMPUTE_BUDGET: u32 =   1_000;
const SUI_GAS_DROPOFF_STORAGE_REBATE: u32 =     260;
const SUI_COMPUTE_BUDGET:             u32 =   2_000;
const SUI_STORAGE_BYTES:              u32 =   2_363;
const SUI_STORAGE_REBATE:             u32 =   1_979;

//TODO update
#[cfg(feature = "mainnet")]
pub const AVALANCHE_ROUTER_ADDRESS: [u8; 32] = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

//TODO update
#[cfg(feature = "testnet")]
pub const AVALANCHE_ROUTER_ADDRESS: [u8; 32] = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

#[cfg(not(any(feature = "mainnet", feature = "testnet")))]
pub const AVALANCHE_ROUTER_ADDRESS: [u8; 32] = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
  0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14,
];

#[event]
pub struct RelayRequest {
  pub cctp_nonce: u64,
  pub gas_dropoff_micro_gas_token: u32,
}

#[event_cpi]
#[derive(Accounts)]
pub struct TransferWithRelay<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  pub user: Signer<'info>, //only distinct from payer when gasless (or when using a delegate)

  #[account(has_one = fee_recipient)]
  pub config: Account<'info, Config>,

  // determines the destination chain
  pub chain_config: Account<'info, ChainConfig>,

  //we can't use the config as the rent recipient because the system program does not allow
  //  calling transfer on accounts with data, so we have to use a separate account for it
  //it is used for paying the cctp message account rent and hence also receives it upon closure
  //its derivation isn't checked since we use it for the transfer and hence the wrong account
  //  won't work anyway (and there's also no malicious account to substitute either, even if bumps
  //  were to coincide)
  /// CHECK: leave Brittney alone
  #[account(mut)]
  pub rent_custodian: AccountInfo<'info>,

  /// CHECK: see has_one constraint
  #[account(mut)]
  pub fee_recipient: AccountInfo<'info>,

  #[account(
    mut,
    associated_token::mint = usdc_mint,
    associated_token::authority = fee_recipient,
  )]
  pub fee_recipient_usdc: Account<'info, TokenAccount>,

  #[account(mut)]
  pub user_usdc: Account<'info, TokenAccount>,

  pub oracle_config: Account<'info, PriceOracleConfigState>,

  #[account(constraint = destination_prices.chain_id == chain_config.chain_id)]
  pub destination_prices: Option<Account<'info, PricesState>>,

  #[account(constraint = avalanche_prices.chain_id == CHAIN_ID_AVALANCHE)]
  pub avalanche_prices: Option<Account<'info, PricesState>>,

  /// CHECK: PDA derived from the user's address and a unique 4 byte seed (e.g. the timestamp)
  #[account(mut)]
  pub message_sent_event_data: AccountInfo<'info>,

  /// CHECK: leave Brittney alone
  #[account(mut)]
  pub usdc_mint: UncheckedAccount<'info>,

  /// CHECK: implementation detail of v2, skipped for v1
  pub denylisted: Option<UncheckedAccount<'info>>,

  /// CHECK: implementation detail of cctp token messenger minter program
  pub token_messenger_minter_sender_authority: UncheckedAccount<'info>,

  /// CHECK: implementation detail of cctp message transmitter program
  #[account(mut)]
  pub message_transmitter_config: UncheckedAccount<'info>,

  /// CHECK: implementation detail of cctp token messenger program
  pub token_messenger_config: UncheckedAccount<'info>,

  /// CHECK: implementation detail of cctp token messenger program
  pub remote_token_messenger_config: UncheckedAccount<'info>,

  /// CHECK: implementation detail of cctp token messenger minter program
  pub token_minter_config: UncheckedAccount<'info>,

  /// CHECK: leave Brittney alone
  #[account(mut)]
  pub local_token: UncheckedAccount<'info>,

  /// CHECK: either v1 or v2
  pub token_messenger_minter_program: UncheckedAccount<'info>,

  /// CHECK: either v1 or v2
  pub message_transmitter_program: UncheckedAccount<'info>,

  /// CHECK: leave Brittney alone
  pub token_messenger_event_authority: UncheckedAccount<'info>,

  pub token_program: Program<'info, Token>,

  pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Corridor {
  V1,
  V2Direct { max_fast_fee_usdc: u64 },
  AvaxHop  { max_fast_fee_usdc: u64 },
}

impl From<Corridor> for FeeAdjustmentType {
  fn from(corridor: Corridor) -> FeeAdjustmentType {
    match corridor {
      Corridor::V1              => FeeAdjustmentType::V1,
      Corridor::V2Direct { .. } => FeeAdjustmentType::V2Direct,
      Corridor::AvaxHop  { .. } => FeeAdjustmentType::AvaxHop,
    }
  }
}

impl From<Corridor> for u8 {
  fn from(corridor: Corridor) -> u8 {
    match corridor {
      Corridor::V1              => 0,
      Corridor::V2Direct { .. } => 1,
      Corridor::AvaxHop  { .. } => 2,
    }
  }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RelayQuote {
  OffChain {
    expiration_time: u32,
    charge_in_usdc: bool,
    relay_fee: u64, //sol or usdc
    quoter_signature: [u8; 65],
  },
  OnChainUsdc {
    max_relay_fee_usdc: u64,
    take_fee_from_input: bool,
  },
  OnChainGas {
    max_relay_fee_sol: u64,
  },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct GaslessParams {
  gasless_fee_usdc: u64,
  expiration_time: u32,
}

#[derive(AnchorSerialize)]
pub struct OffChainQuoteData {
  source_domain:      u8,
  destination_domain: u8,
  corridor:           u8,
  gas_dropoff:     [u8; 4], //use array and .to_be_bytes() to avoid endianness issue
  expiration_time: [u8; 4], //use array and .to_be_bytes() to avoid endianness issue
  pay_in_usdc:      bool,
  relay_fee:       [u8; 8], //use array and .to_be_bytes() to avoid endianness issue
}

#[derive(AnchorSerialize, InitSpace)]
pub struct AvaxHopMessage {
  pub destination_domain: u8,
  pub mint_recipient: [u8; 32],
  pub gas_dropoff_micro_gas_token: [u8; 4], //use array and .to_be_bytes() to avoid endianness issue
}

pub fn transfer_with_relay(
  ctx: Context<TransferWithRelay>,
  input_amount: u64,
  mint_recipient: [u8; 32],
  gas_dropoff_micro_gas_token: u32,
  corridor: Corridor,
  quote: RelayQuote,
  gasless: Option<GaslessParams>,
  message_sent_event_data_seed: [u8; 4],
  message_sent_event_data_bump: u8,
) -> Result<()> {
  let accs = &ctx.accounts;

  let destination_domain = accs.chain_config.domain_id;
  let is_avax_hop = matches!(corridor, Corridor::AvaxHop { .. });

  let calc_onchain_relay_fee_usdc = || -> Result<u64> {
    let corridor_fee_adjustment = accs.chain_config.get_fee_adjustment(corridor.into());

    let avax_hop_execution_fee_micro_usd = conditional_fee(is_avax_hop, || {
      calc_execution_fee_micro_usd(accs.avalanche_prices.as_deref(), AVAX_HOP_GAS_COST, 0, 0, 0, 0)
    })?;

    let destination_execution_fee_micro_usd = conditional_fee(
      corridor_fee_adjustment.relative_percent_bps != 0,
      || {
        let (evm_transaction_gas, evm_transaction_size) =
          if matches!(corridor, Corridor::V2Direct {..})
            { (EVM_V2_GAS_COST, EVM_V2_BILLED_SIZE) }
          else
            { (EVM_V1_GAS_COST, EVM_V1_BILLED_SIZE) };

        let (evm_transaction_gas, sui_computation_units, sui_stored_bytes, sui_deleted_bytes) =
          if gas_dropoff_micro_gas_token == 0 {
            ( evm_transaction_gas,
              SUI_COMPUTE_BUDGET,
              SUI_STORAGE_BYTES,
              SUI_STORAGE_REBATE,
            )
          }
          else {
            ( evm_transaction_gas + EVM_GAS_DROPOFF_GAS_COST,
              SUI_COMPUTE_BUDGET + SUI_GAS_DROPOFF_COMPUTE_BUDGET,
              SUI_STORAGE_BYTES  + SUI_GAS_DROPOFF_STORAGE_BYTES,
              SUI_STORAGE_REBATE + SUI_GAS_DROPOFF_STORAGE_REBATE,
            )
          };

        calc_execution_fee_micro_usd(
          accs.destination_prices.as_deref(),
          evm_transaction_gas,
          evm_transaction_size,
          sui_computation_units,
          sui_stored_bytes,
          sui_deleted_bytes
        )
      }
    )?;

    let total_execution_fee_micro_usd = corridor_fee_adjustment.apply(
      int_to_u64(Int::Ok(avax_hop_execution_fee_micro_usd) + destination_execution_fee_micro_usd)?
    )?;

    let gas_dropoff_fee_micro_usd = conditional_fee(gas_dropoff_micro_gas_token > 0, || {
      let gas_dropoff_fee_adjustment =
        accs.chain_config.get_fee_adjustment(FeeAdjustmentType::GasDropoff);

      let unadjusted_micro_usd = conditional_fee(
        gas_dropoff_fee_adjustment.relative_percent_bps != 0,
        || {
          require!(accs.destination_prices.is_some(), CctprError::InvalidTransferArgs);
          accs.destination_prices.as_ref().unwrap()
            .micro_gas_token_to_micro_usd(gas_dropoff_micro_gas_token)
        }
      )?;

      gas_dropoff_fee_adjustment.apply(unadjusted_micro_usd)
    })?;

    int_to_u64(Int::Ok(total_execution_fee_micro_usd) + gas_dropoff_fee_micro_usd)
  };

  let rent_rebate_sol =
    Rent::get()?.minimum_balance(
      if corridor == Corridor::V1 {
        deposit::v1::MESSAGE_SENT_EVENT_DATA_SIZE
      }
      else {
        deposit::v2::MESSAGE_SENT_EVENT_DATA_SIZE +
          if is_avax_hop { AvaxHopMessage::INIT_SPACE } else { 0 }
      }
    );

  system_program::transfer(
    CpiContext::new(
      accs.system_program.to_account_info(),
      system_program::Transfer {
        from: accs.payer.to_account_info(),
        to: accs.rent_custodian.to_account_info(),
      },
    ),
    rent_rebate_sol,
  )?;

  let (charge_in_usdc, relay_fee, transfer_amount) = match quote {
    RelayQuote::OnChainGas  { max_relay_fee_sol } => {
      let relay_fee_usdc = calc_onchain_relay_fee_usdc()?;
      let relay_fee_sol =
        accs.oracle_config.micro_usd_to_sol(relay_fee_usdc)?.saturating_sub(rent_rebate_sol);
      require!(relay_fee_sol <= max_relay_fee_sol, CctprError::ExceedsMaxFee);
      (false, relay_fee_sol, input_amount)
    }
    RelayQuote::OnChainUsdc { max_relay_fee_usdc, take_fee_from_input } => {
      let rent_rebate_usdc = conditional_fee(gasless.is_none(), || {
        accs.oracle_config.sol_to_micro_usd(rent_rebate_sol)
      })?;
      let relay_fee_usdc = calc_onchain_relay_fee_usdc()?.saturating_sub(rent_rebate_usdc);
      require!(relay_fee_usdc <= max_relay_fee_usdc, CctprError::ExceedsMaxFee);
      let transfer_amount = if take_fee_from_input {
        require!(max_relay_fee_usdc < input_amount, CctprError::InvalidTransferArgs);
        input_amount - relay_fee_usdc
      }
      else {
        input_amount
      };
      (true, relay_fee_usdc, transfer_amount)
    }
    RelayQuote::OffChain {
      charge_in_usdc,
      relay_fee,
      expiration_time,
      quoter_signature,
    } => {
      let now = Clock::get()?.unix_timestamp as u32;
      require!(now < expiration_time, CctprError::QuoteExpired);

      let quote_data = OffChainQuoteData {
        source_domain:   DOMAIN_ID_SOLANA,
        destination_domain,
        corridor:        corridor.into(),
        gas_dropoff:     gas_dropoff_micro_gas_token.to_be_bytes(),
        expiration_time: expiration_time.to_be_bytes(),
        pay_in_usdc:     charge_in_usdc,
        relay_fee:       relay_fee.to_be_bytes(),
      };
      let quote_hash = hash(&quote_data.try_to_vec().unwrap().as_slice()).0;
      require!(
        secp256k1_recover(&quote_hash, quoter_signature[64] - 27, &quoter_signature[..64])
          .map(|pubkey| hash(&pubkey.0).0)
          .ok().filter(|recovered_pubkey| &recovered_pubkey[12..] == accs.config.offchain_quoter)
          .is_some(),
        CctprError::OffchainQuoterSignatureInvalid,
      );

      (charge_in_usdc, relay_fee, input_amount)
    }
  };

  let total_fee = if let Some(GaslessParams {
    gasless_fee_usdc,
    expiration_time,
  }) = gasless {
    require!(charge_in_usdc, CctprError::InvalidTransferArgs);
    let now = Clock::get()?.unix_timestamp as u32;
    require!(now < expiration_time, CctprError::GaslessPermissionExpired);
    int_to_u64(Int::Ok(relay_fee) + gasless_fee_usdc)?
  }
  else {
    relay_fee
  };

  if charge_in_usdc {
    token::transfer(
      CpiContext::new(
        accs.token_program                   .to_account_info(),
        token::Transfer {
          from:      accs.user_usdc          .to_account_info(),
          to:        accs.fee_recipient_usdc .to_account_info(),
          authority: accs.user               .to_account_info(),
        },
      ),
      total_fee,
    )?;
  }
  else {
    system_program::transfer(
      CpiContext::new(
        accs.system_program        .to_account_info(),
        system_program::Transfer {
          from: accs.payer         .to_account_info(),
          to:   accs.fee_recipient .to_account_info(),
        },
      ),
      total_fee,
    )?;
  }

  let user_key = accs.user.key();
  let message_sent_event_data_seeds: &[&[u8]] = &[
    user_key.as_ref(),
    message_sent_event_data_seed.as_ref(),
    &[message_sent_event_data_bump],
  ];
  let rent_seeds: &[&[u8]] = &[Config::RENT_SEED_PREFIX, &[ctx.accounts.config.rent_bump]];
  let signer_seeds: &[&[&[u8]]] = &[message_sent_event_data_seeds, rent_seeds];

  let cctp_nonce =
    if let Corridor::V1 = corridor {
      deposit::v1::deposit_for_burn(
        CpiContext::new_with_signer(
          ctx.accounts.token_messenger_minter_program.to_account_info(),
          deposit::v1::Deposit {
            burn_token_owner:                          ctx.accounts
              .user                                    .to_account_info(),
            payer:                                     ctx.accounts
              .rent_custodian                          .to_account_info(),
            token_messenger_minter_sender_authority:   ctx.accounts
              .token_messenger_minter_sender_authority .to_account_info(),
            burn_token:                                ctx.accounts
              .user_usdc                               .to_account_info(),
            message_transmitter_config:                ctx.accounts
              .message_transmitter_config              .to_account_info(),
            token_messenger_config:                    ctx.accounts
              .token_messenger_config                  .to_account_info(),
            remote_token_messenger_config:             ctx.accounts
              .remote_token_messenger_config           .to_account_info(),
            token_minter_config:                       ctx.accounts
              .token_minter_config                     .to_account_info(),
            local_token:                               ctx.accounts
              .local_token                             .to_account_info(),
            burn_token_mint:                           ctx.accounts
              .usdc_mint                               .to_account_info(),
            message_sent_event_data:                   ctx.accounts
              .message_sent_event_data                 .to_account_info(),
            message_transmitter_program:               ctx.accounts
              .message_transmitter_program             .to_account_info(),
            token_messenger_minter_program:            ctx.accounts
              .token_messenger_minter_program          .to_account_info(),
            token_program:                             ctx.accounts
              .token_program                           .to_account_info(),
            system_program:                            ctx.accounts
              .system_program                          .to_account_info(),
            event_authority:                           ctx.accounts
              .token_messenger_event_authority         .to_account_info(),
          },
          signer_seeds,
        ),
        deposit::v1::DepositForBurnParams {
          amount: transfer_amount,
          destination_domain: destination_domain as u32,
          mint_recipient,
        },
      )?
    }
    else {
      require!(accs.denylisted.is_some(), CctprError::InvalidTransferArgs);

      let (is_avax_hop, max_fee) = match corridor {
        Corridor::V2Direct { max_fast_fee_usdc } => (false, max_fast_fee_usdc),
        Corridor::AvaxHop  { max_fast_fee_usdc } => (true,  max_fast_fee_usdc),
        _ => unreachable!(),
      };

      let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_messenger_minter_program.to_account_info(),
        deposit::v2::Deposit {
          burn_token_owner:                          ctx.accounts
            .user                                    .to_account_info(),
          payer:                                     ctx.accounts
            .rent_custodian                          .to_account_info(),
          token_messenger_minter_sender_authority:   ctx.accounts
            .token_messenger_minter_sender_authority .to_account_info(),
          burn_token:                                ctx.accounts
            .user_usdc                               .to_account_info(),
          denylisted:                                ctx.accounts
            .denylisted.as_ref().unwrap()            .to_account_info(),
          message_transmitter_config:                ctx.accounts
            .message_transmitter_config              .to_account_info(),
          token_messenger_config:                    ctx.accounts
            .token_messenger_config                  .to_account_info(),
          remote_token_messenger_config:             ctx.accounts
            .remote_token_messenger_config           .to_account_info(),
          token_minter_config:                       ctx.accounts
            .token_minter_config                     .to_account_info(),
          local_token:                               ctx.accounts
            .local_token                             .to_account_info(),
          burn_token_mint:                           ctx.accounts
            .usdc_mint                               .to_account_info(),
          message_sent_event_data:                   ctx.accounts
            .message_sent_event_data                 .to_account_info(),
          message_transmitter_program:               ctx.accounts
            .message_transmitter_program             .to_account_info(),
          token_messenger_minter_program:            ctx.accounts
            .token_messenger_minter_program          .to_account_info(),
          token_program:                             ctx.accounts
            .token_program                           .to_account_info(),
          system_program:                            ctx.accounts
            .system_program                          .to_account_info(),
          event_authority:                           ctx.accounts
            .token_messenger_event_authority         .to_account_info(),
        },
        signer_seeds,
      );

      let burn_params = deposit::v2::DepositForBurnParams {
        amount: transfer_amount,
        destination_domain:
          if is_avax_hop { DOMAIN_ID_AVALANCHE } else { destination_domain } as u32,
        mint_recipient,
        destination_caller:
          if is_avax_hop { AVALANCHE_ROUTER_ADDRESS } else { [0; 32] },
        max_fee,
        min_finality_threshold: 0,
      };

      if is_avax_hop {
        let avax_hop_message = AvaxHopMessage {
          destination_domain,
          mint_recipient,
          gas_dropoff_micro_gas_token: gas_dropoff_micro_gas_token.to_be_bytes(),
        };

        deposit::v2::deposit_for_burn_with_hook(
          burn_ctx,
          deposit::v2::DepositForBurnWithHookParams {
            shared: burn_params,
            hook_data: avax_hop_message.try_to_vec().unwrap(),
          },
        )?;
      }
      else {
        deposit::v2::deposit_for_burn(burn_ctx, burn_params)?;
      }

      0_u64
    };

  emit_cpi!(RelayRequest{ cctp_nonce, gas_dropoff_micro_gas_token });

  Ok(())
}

fn calc_execution_fee_micro_usd(
  prices: Option<&PricesState>,
  evm_transaction_gas: u32,
  evm_transaction_size: u32,
  sui_computation_units: u32,
  sui_stored_bytes: u32,
  sui_deleted_bytes: u32,
) -> Result<u64> {
  require!(prices.is_some(), CctprError::InvalidTransferArgs);
  let config = TargetChainsConfig {
    evm_transaction_gas,
    evm_transaction_size,
    sui_computation_units,
    sui_stored_bytes,
    sui_deleted_bytes,
  };
  prices.unwrap().calc_total_fee_micro_usd(&config, 0, 0)
}

// makes code more DRY by replacing `if condition { computation()? } else { 0 }`
fn conditional_fee<F>(condition: bool, computation: F) -> Result<u64>
  where F: FnOnce() -> Result<u64>
{
  condition.then(computation).transpose().map(|opt| opt.unwrap_or(0))
}
