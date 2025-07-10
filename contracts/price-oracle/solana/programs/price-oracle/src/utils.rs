use anchor_lang::prelude::*;
use std::fmt;
use crate::int::Int;
use crate::error::PriceOracleError;

pub const SOLANA_CHAIN_ID: u16 = 1;
pub const ETHEREUM_CHAIN_ID: u16 = 2;
pub const SUI_CHAIN_ID: u16 = 21;

#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub enum Platform {
    Sol,
    Evm,
    Sui,
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl Platform {
    pub fn from_chain_id(chain_id: u16) -> Option<Self> {
        match chain_id {
            0 => None,
            SOLANA_CHAIN_ID => Some(Platform::Sol),
            SUI_CHAIN_ID => Some(Platform::Sui),
            _ => Some(Platform::Evm),
        }
    }
}

pub fn int_to_u64(val: Int<u64>) -> Result<u64> {
    match val {
        Int::Ok(val) => Ok(val),
        Int::Overflow => Err(PriceOracleError::Overflow.into()),
        Int::DivisionByZero => Err(PriceOracleError::DivisionByZero.into()),
    }
}

/// Empties the account balance to the provided recipient.
pub struct DrainAccount<'info> {
    pub system_program: AccountInfo<'info>,
    pub account: AccountInfo<'info>,
    pub recipient: AccountInfo<'info>,
}

impl<'info> DrainAccount<'info> {
    pub fn run_with_seeds(self, seeds: &[&[u8]]) -> Result<()> {
        if self.account.lamports() != 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    self.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: self.account.clone(),
                        to: self.recipient,
                    },
                    &[seeds],
                ),
                self.account.lamports(),
            )?;
        }

        Ok(())
    }
}
