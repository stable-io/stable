mod error;
mod id;
mod cctp_cpi;
mod processor;
mod state;

use anchor_lang::prelude::*;
use processor::*;
use state::{FeeAdjustment, FeeAdjustmentType};

pub use id::ID;

#[program]
pub mod cctpr {
  use super::*;

  pub fn transfer_with_relay(
    ctx: Context<TransferWithRelay>,
    input_amount: u64,
    mint_recipient: [u8; 32],
    gas_dropoff_micro_gas_token: u32,
    corridor: Corridor,
    quote: RelayQuote,
    gasless: Option<GaslessParams>,
  ) -> Result<()> {
    processor::transfer_with_relay(
      ctx,
      input_amount,
      mint_recipient,
      gas_dropoff_micro_gas_token,
      corridor,
      quote,
      gasless,
    )
  }

  // pub fn get_quote(ctx: Context<QuoteQuery>, dropoff_amount_micro: u32) -> Result<u64> {
  //   processor::get_quote(ctx, dropoff_amount_micro)
  // }

  // -- Reclaim --

  pub fn reclaim_rent(
    ctx: Context<ReclaimRent>,
    attestation: Vec<u8>,
    destination_message: Vec<u8>, 
  ) -> Result<()> {
    processor::reclaim_rent(ctx, attestation, destination_message)
  }

  pub fn transfer_surplus_sol(
    ctx: Context<TransferSurplusSol>,
  ) -> Result<()> {
    processor::transfer_surplus_sol(ctx)
  }

  // -- Governance --

  pub fn initialize(
    ctx: Context<Initialize>,
    owner: Pubkey,
    fee_adjuster: Pubkey,
    fee_recipient: Pubkey,
    offchain_quoter: [u8; 20],
  ) -> Result<()> {
    processor::initialize(ctx, owner, fee_adjuster, fee_recipient, offchain_quoter)
  }

  pub fn register_chain(
    ctx: Context<RegisterChain>,
    domain_id: u8,
    chain_id: u16,
  ) -> Result<()> {
    processor::register_chain(ctx, domain_id, chain_id)
  }

  pub fn deregister_chain(ctx: Context<DeregisterChain>) -> Result<()> {
    processor::deregister_chain(ctx)
  }

  pub fn update_fee_adjustment(
    ctx: Context<UpdateFeeAdjustment>,
    adjustment_type: FeeAdjustmentType,
    new_fee_adjustment: FeeAdjustment,
  ) -> Result<()> {
    processor::update_fee_adjustment(ctx, adjustment_type, new_fee_adjustment)
  }

  pub fn submit_owner_transfer_request(
    ctx: Context<OwnerContext>,
    new_owner: Pubkey,
  ) -> Result<()> {
    processor::submit_owner_transfer_request(ctx, new_owner)
  }

  pub fn cancel_owner_transfer_request(ctx: Context<OwnerContext>) -> Result<()> {
    processor::cancel_owner_transfer_request(ctx)
  }

  pub fn confirm_owner_transfer_request(ctx: Context<ConfirmOwnerTransfer>) -> Result<()> {
    processor::confirm_owner_transfer_request(ctx)
  }

  pub fn update_fee_recipient(
    ctx: Context<RoleUpdate>,
    new_fee_recipient: Pubkey,
  ) -> Result<()> {
    processor::update_fee_recipient(ctx, new_fee_recipient)
  }

  pub fn update_fee_adjuster(
    ctx: Context<RoleUpdate>,
    new_fee_adjuster: Pubkey,
  ) -> Result<()> {
    processor::update_fee_adjuster(ctx, new_fee_adjuster)
  }

  pub fn update_offchain_quoter(
    ctx: Context<RoleUpdate>,
    new_offchain_quoter: [u8; 20],
  ) -> Result<()> {
    processor::update_offchain_quoter(ctx, new_offchain_quoter)
  }
}
