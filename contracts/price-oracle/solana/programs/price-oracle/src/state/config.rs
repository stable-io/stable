use anchor_lang::{prelude::*, solana_program::native_token::LAMPORTS_PER_SOL};
use crate::{int::Int, utils::int_to_u64};

#[account]
#[derive(InitSpace)]
/// The program's main account.
pub struct PriceOracleConfigState {
    /// Program's owner.
    pub owner: Pubkey,

    /// Intermediate storage for the pending owner. Is used to transfer ownership.
    pub pending_owner: Option<Pubkey>,

    /// The SOL price in μusd/SOL.
    pub sol_price: u64,
}

impl PriceOracleConfigState {
    pub fn is_pending_owner(&self, account: &impl Key) -> bool {
        self.pending_owner == Some(account.key())
    }

    pub fn micro_usd_to_sol(&self, micro_usd: u64) -> Result<u64> {
        // μusd * lamports/SOL / μusd/SOL
        int_to_u64(Int::Ok(micro_usd) * LAMPORTS_PER_SOL / self.sol_price)
    }

    pub fn sol_to_micro_usd(&self, lamports: u64) -> Result<u64> {
        // lamports * μusd/SOL / lamports/SOL
        int_to_u64(Int::Ok(lamports) * self.sol_price / LAMPORTS_PER_SOL)
    }

    /// AKA `b"config"`.
    pub const SEED_PREFIX: &'static [u8; 6] = b"config";
}
