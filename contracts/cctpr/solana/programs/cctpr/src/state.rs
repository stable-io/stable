use anchor_lang::prelude::*;
use price_oracle::{int::Int, utils::int_to_u64};

#[account]
#[derive(InitSpace)]
pub struct Config {
  pub owner:           Pubkey,
  pub pending_owner:   Pubkey,
  pub fee_adjuster:    Pubkey,
  pub fee_recipient:   Pubkey,
  pub offchain_quoter: [u8; 20],
  pub rent_bump:       u8,
}

impl Config {
  pub const SEED_PREFIX: &[u8] = b"config";
  pub const RENT_SEED_PREFIX: &[u8] = b"rent";
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
#[repr(u8)]
pub enum FeeAdjustmentType {
  V1,
  V2Direct,
  AvaxHop,
  GasDropoff,
}

impl FeeAdjustmentType {
  pub const COUNT: usize = 4;
}

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Default, Clone)]
pub struct FeeAdjustment {
  pub absolute_usd: i32,
  pub relative_percent_bps: u32,
}

impl FeeAdjustment {
  const BASIS_POINTS: u64 = 10_000;
  pub fn apply(&self, micro_usd: u64) -> Result<u64> {
    let with_relative = Int::Ok(micro_usd) * self.relative_percent_bps as u64 / Self::BASIS_POINTS;
    let with_absolute = if self.absolute_usd >= 0 {
      int_to_u64(with_relative + self.absolute_usd as u64)?
    } else {
      let with_relative_u64 = int_to_u64(with_relative)?;
      if with_relative_u64 > (-self.absolute_usd) as u64 {
        with_relative_u64 - (-self.absolute_usd) as u64
      } else {
        0
      }
    };
    Ok(with_absolute)
  }
}

#[account]
#[derive(InitSpace)]
pub struct ChainConfig {
  pub domain_id: u8,
  pub chain_id: u16,
  fee_adjustments: [FeeAdjustment; FeeAdjustmentType::COUNT],
}

impl ChainConfig {
  pub const SEED_PREFIX: &[u8] = b"chain_config";

  pub fn get_fee_adjustment(&self, adjustment_type: FeeAdjustmentType) -> &FeeAdjustment {
    &self.fee_adjustments[adjustment_type as usize]
  }

  pub fn set_fee_adjustment(
    &mut self,
    adjustment_type: FeeAdjustmentType,
    adjustment: FeeAdjustment
  ) {
    self.fee_adjustments[adjustment_type as usize] = adjustment;
  }
}
