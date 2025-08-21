use crate::{int::Int, utils::{Platform, int_to_u64}};
use anchor_lang::prelude::*;
#[cfg(feature = "idl-build")]
use anchor_lang::{
    IdlBuild,
    idl::types::{
        IdlArrayLen, IdlDefinedFields, IdlField, IdlSerialization, IdlType, IdlTypeDef, IdlTypeDefTy,
    },
};
use std::io;

use super::PriceOracleConfigState;

const SUI_MIN_TRANSACTION_COST_MIST: u64 = 2_000;

const MICRO_GAS_TOKEN_PER_GAS_TOKEN: u64 = 1_000_000;
const MWEI_PER_MICRO_ETH: u64 = 1_000_000;
const MWEI_PER_ETH: u64 = 1_000_000_000_000;
const MIST_PER_SUI: u64 = 1_000_000_000;

/// Chain prices.
#[derive(Clone, Copy, Debug)]
pub struct PricesState {
    /// The chain that will be read or updated is identified by this field.
    /// If chain_id is 0, it means that the account is not initialized.
    pub chain_id: u16,

    /// The gas price in μusd/Token.
    pub gas_token_price: u64,

    /// The prices for the chain, in µToken.
    pub prices: PricesStatePlatform,
}

#[derive(Clone, Copy, Debug)]
pub enum PricesStatePlatform {
    Uninitialized([u8; Self::SIZE]),
    Evm {
        /// The gas price / base fee for the Ethereum transaction, in Mwei/gas.
        gas_price: u32,

        /// Regulates the cost of including L2 transactions in the Ethereum chain, in Mwei/byte.
        price_per_tx_byte: u32,
    },
    Sui {
        /// How much one Computation Unit costs in MIST (10⁻⁹SUI).
        computation_unit_price: u32,

        /// How much one stored byte costs in MIST (10⁻⁹SUI).
        byte_price: u32,

        /// A percentage of the storage cost that is rebated to the user.
        rebate_ratio: u8,
    },
}

impl PricesStatePlatform {
    const SIZE: usize = 16;
}

impl Space for PricesState {
    const INIT_SPACE: usize = std::mem::size_of::<u16>() /* chain_id */
        + std::mem::size_of::<u64>() /* gas_token_price */
        + PricesStatePlatform::SIZE;
}

impl Owner for PricesState {
    fn owner() -> Pubkey {
        crate::ID
    }
}

#[cfg(feature = "idl-build")]
impl IdlBuild for PricesState {
    fn create_type() -> Option<IdlTypeDef> {
        Some(IdlTypeDef {
            name: "PricesState".to_string(),
            docs: vec![],
            serialization: IdlSerialization::Borsh,
            repr: None,
            generics: vec![],
            ty: IdlTypeDefTy::Struct {
                fields: Some(IdlDefinedFields::Named(vec![
                    IdlField {
                        name: "chain_id".to_string(),
                        docs: vec![],
                        ty: IdlType::U16,
                    },
                    IdlField {
                        name: "gas_token_price".to_string(),
                        docs: vec![],
                        ty: IdlType::U64,
                    },
                    IdlField {
                        name: "prices".to_string(),
                        docs: vec![],
                        ty: IdlType::Array(Box::new(IdlType::U8), IdlArrayLen::Value(16)),
                    },
                ])),
            },
        })
    }
}

impl Discriminator for PricesState {
    // Equals sha256("account:PricesState")[..8]
    const DISCRIMINATOR: &'static [u8] = &[0x37, 0x89, 0x31, 0xBB, 0x0F, 0x63, 0x01, 0x1E];
}

impl AccountSerialize for PricesState {
    fn try_serialize<W: io::Write>(&self, writer: &mut W) -> Result<()> {
        writer.write_all(Self::DISCRIMINATOR)?;
        self.serialize(writer)?;

        Ok(())
    }
}

impl AccountDeserialize for PricesState {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        let discriminator = &(*buf)[..8];
        if discriminator != Self::DISCRIMINATOR {
            return Err(ErrorCode::AccountDiscriminatorMismatch.into());
        }

        Self::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        Self::deserialize_reader(&mut &(*buf)[8..]).map_err(|e| e.into())
    }
}

impl AnchorSerialize for PricesState {
    fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
        self.chain_id.serialize(writer)?;
        self.gas_token_price.serialize(writer)?;
        self.prices.serialize(writer)?;
        Ok(())
    }
}

impl AnchorDeserialize for PricesState {
    fn deserialize_reader<R: io::Read>(reader: &mut R) -> io::Result<Self> {
        let chain_id = u16::deserialize_reader(reader)?;
        let gas_token_price = u64::deserialize_reader(reader)?;
        let prices = PricesStatePlatform::deserialize_reader(reader, chain_id)?;
        Ok(PricesState {
            chain_id,
            gas_token_price,
            prices,
        })
    }
}

impl PricesStatePlatform {
    fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
        match self {
            PricesStatePlatform::Uninitialized(_) => {
                writer.write_all(&[0; PricesStatePlatform::SIZE])?;
            }
            PricesStatePlatform::Evm {
                gas_price,
                price_per_tx_byte,
            } => {
                gas_price.serialize(writer)?;
                price_per_tx_byte.serialize(writer)?;
            }
            PricesStatePlatform::Sui {
                computation_unit_price,
                byte_price,
                rebate_ratio,
            } => {
                computation_unit_price.serialize(writer)?;
                byte_price.serialize(writer)?;
                rebate_ratio.serialize(writer)?;
            }
        }

        Ok(())
    }
}

impl PricesStatePlatform {
    fn deserialize_reader<R: io::Read>(reader: &mut R, chain_id: u16) -> io::Result<Self> {
        match Platform::from_chain_id(chain_id) {
            Some(Platform::Evm) => {
                let gas_price = u32::deserialize_reader(reader)?;
                let price_per_tx_byte = u32::deserialize_reader(reader)?;
                Ok(PricesStatePlatform::Evm {
                    gas_price,
                    price_per_tx_byte,
                })
            }
            Some(Platform::Sui) => {
                let computation_unit_price = u32::deserialize_reader(reader)?;
                let byte_price = u32::deserialize_reader(reader)?;
                let rebate_ratio = u8::deserialize_reader(reader)?;
                Ok(PricesStatePlatform::Sui {
                    computation_unit_price,
                    byte_price,
                    rebate_ratio,
                })
            }
            None => Ok(PricesStatePlatform::Uninitialized([0; 16])),
            Some(Platform::Sol) => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Solana cannot be registered as a foreign chain",
            )),
        }
    }
}

impl PricesState {
    pub const SEED_PREFIX: &'static [u8] = b"prices";

    pub fn micro_gas_token_to_micro_usd(&self, micro_gas_token: u32) -> Result<u64> {
        int_to_u64(Int::Ok(self.gas_token_price) * micro_gas_token / MICRO_GAS_TOKEN_PER_GAS_TOKEN)
    }

    pub fn calc_total_fee_micro_usd(
        &self,
        config: &TargetChainsConfig,
        flat_fee_micro_token: u32,
        flat_fee_micro_usd: u32,
    ) -> Result<u64> {
        int_to_u64(self.internal_calc_total_fee_micro_usd(
            config,
            flat_fee_micro_token,
            flat_fee_micro_usd,
        ))
    }

    /// Returns the fee for running a target contract on another chain in lamports.
    ///
    /// # Arguments
    ///
    /// - `oracle_config`: the account holding the SOL price.
    /// - `config`: the config for the contract on the target chains. If a chain is not supported, just use 0.
    /// - `flat_fee_micro_token`: any kind of flat fee (for example a dropoff), in µ-target-token.
    /// - `flat_fee_micro_usd`: any kind of flat fee (for example the relaying fee), in µ-usd.
    pub fn calculate_total_fee(
        &self,
        oracle_config: &PriceOracleConfigState,
        config: &TargetChainsConfig,
        flat_fee_micro_token: u32,
        flat_fee_micro_usd: u32,
    ) -> Result<u64> {
        let total_fees_micro_usd = self.internal_calc_total_fee_micro_usd(
            config,
            flat_fee_micro_token,
            flat_fee_micro_usd,
        );

        oracle_config.micro_usd_to_sol(int_to_u64(total_fees_micro_usd)?)
    }

    fn internal_calc_total_fee_micro_usd(
        &self,
        config: &TargetChainsConfig,
        flat_fee_micro_token: u32,
        flat_fee_micro_usd: u32,
    ) -> Int<u64> {
        let flat_fee_micro_token = u64::from(flat_fee_micro_token);
        let flat_fee_micro_usd = u64::from(flat_fee_micro_usd);
        (match self.prices {
            PricesStatePlatform::Evm {
                gas_price,
                price_per_tx_byte,
            } => {
                // Mwei = gas * Mwei/gas + bytes * Mwei/byte + µToken * Mwei/µToken
                let total_fees_mwei = Int::Ok(config.evm_transaction_gas) * gas_price
                    + Int::Ok(config.evm_transaction_size) * price_per_tx_byte
                    + Int::Ok(flat_fee_micro_token) * MWEI_PER_MICRO_ETH;

                // μusd = Mwei * μusd/Token / Mwei/Token
                total_fees_mwei.mul_div(self.gas_token_price, MWEI_PER_ETH)
            }
            PricesStatePlatform::Sui {
                computation_unit_price,
                byte_price,
                rebate_ratio,
            } => {
                let bytes_ratio = {
                    let rebate =
                        u64::from(config.sui_deleted_bytes) * u64::from(rebate_ratio) / 100_u64;
                    let stored_bytes = u64::from(config.sui_stored_bytes);

                    if rebate > stored_bytes {
                        Int::Ok(0)
                    } else {
                        Int::Ok(stored_bytes) - Int::Ok(rebate)
                    }
                };

                // MIST = CU * MIST/CU
                let computation_fee =
                    Int::Ok(config.sui_computation_units) * computation_unit_price;
                // MIST = bytes * MIST/byte
                let storage_fee = bytes_ratio * byte_price;

                let total_fees_mist: Int<u64> =
                    computation_fee + storage_fee + (flat_fee_micro_token * 1_000);

                // μusd = MIST * μusd/SUI / MIST/SUI
                total_fees_mist.at_least(SUI_MIN_TRANSACTION_COST_MIST) * self.gas_token_price
                    / MIST_PER_SUI
            }
            // This should never happen, because the account is initialized as soon as allocated.
            PricesStatePlatform::Uninitialized(_) => panic!("Uninitialized prices"),
        }) + Int::Ok(flat_fee_micro_usd)
    }
}

/// The configuration for the target chains contracts.
#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize, InitSpace)]
pub struct TargetChainsConfig {
    /// The gas price of the target contract on the EVM chain.
    pub evm_transaction_gas: u32,
    /// The transaction size in bytes of the target contract on the EVM chain.
    pub evm_transaction_size: u32,

    /// The amount of computation units the target contract on the Sui chain uses.
    /// Must be the ceiling from the corresponding bucket (see SUI cost model).
    pub sui_computation_units: u32,
    /// The amount of storage units the target contract on the Sui chain uses.
    pub sui_stored_bytes: u32,
    /// The amount of storage units the target contract on the Sui chain deletes after the transaction.
    pub sui_deleted_bytes: u32,
}

#[test]
fn total_fee_calculation_for_evm_works() {
    let prices = PricesState {
        chain_id: crate::utils::ETHEREUM_CHAIN_ID,
        gas_token_price: 2_000_000, // 2 USD per ETH
        prices: PricesStatePlatform::Evm {
            gas_price: 30,      // 30 Mwei/gas
            price_per_tx_byte: 16, // 16 Mwei/byte
        },
    };

    let oracle_config = PriceOracleConfigState {
        sol_price: 20_000_000, // 20 USD per SOL
        owner: Pubkey::default(),
        pending_owner: None,
    };

    let config = TargetChainsConfig {
        evm_transaction_gas: 100_000, // 100k gas
        evm_transaction_size: 1_000,  // 1kb
        sui_computation_units: 0,
        sui_stored_bytes: 0,
        sui_deleted_bytes: 0,
    };

    let flat_fee_micro_token = 1_000; // 0.001 ETH
    let flat_fee_micro_usd = 500_000; // 0.5 USD

    let fee = prices
        .calculate_total_fee(
            &oracle_config,
            &config,
            flat_fee_micro_token,
            flat_fee_micro_usd,
        )
        .unwrap();

    // Expected calculation:
    // 1. Gas cost in Mwei: 100_000 * 30 = 3_000_000
    // 2. Byte cost in Mwei: 1_000 * 16 = 16_000
    // 3. Flat fee in Mwei: 1_000 * 1_000_000 = 1_000_000_000
    // 4. Total Mwei: 1_003_016_000
    // 5. Convert to µUSD: 1_003_016_000 * 2_000_000 / 1_000_000_000_000 = 2_006
    // 6. Add flat fee in µUSD: 2_006 + 500_000 = 502_006
    // 7. Convert to lamports: 502_006 * LAMPORTS_PER_SOL / 20_000_000 = 25_100_300

    assert_eq!(fee, 25_100_300);
}

#[test]
fn total_fee_calculation_for_sui_works() {
    let prices = PricesState {
        chain_id: crate::utils::SUI_CHAIN_ID,
        gas_token_price: 500_000, // 0.5 USD per SUI
        prices: PricesStatePlatform::Sui {
            computation_unit_price: 100, // 100 MIST per CU
            byte_price: 100,             // 100 MIST per byte
            rebate_ratio: 95,            // 95% storage rebate
        },
    };

    let oracle_config = PriceOracleConfigState {
        sol_price: 20_000_000, // 20 USD per SOL
        owner: Pubkey::default(),
        pending_owner: None,
    };

    let config = TargetChainsConfig {
        evm_transaction_gas: 0,
        evm_transaction_size: 0,
        sui_computation_units: 1_000, // 1k computation units
        sui_stored_bytes: 1_000,      // 1kb storage
        sui_deleted_bytes: 100,       // 100 bytes deleted
    };

    let flat_fee_micro_token = 1_000; // 0.001 SUI
    let flat_fee_micro_usd = 500_000; // 0.5 USD

    let fee = prices
        .calculate_total_fee(
            &oracle_config,
            &config,
            flat_fee_micro_token,
            flat_fee_micro_usd,
        )
        .unwrap();

    // Expected calculation:
    // 1. Storage bytes after rebate: 1_000 - (100 * 95 / 100) = 905 bytes
    // 2. Computation cost in MIST: 1_000 * 100 = 100_000
    // 3. Storage cost in MIST: 985 * 100 = 98_500
    // 4. Flat fee in MIST: 1_000 * 1_000 = 1_000_000
    // 5. Total MIST (max with min tx cost): max(1_198_500, 2_000) = 1_198_500
    // 6. Convert to µUSD: 1_198_500 * 500_000 / 1_000_000_000 = 599
    // 7. Add flat fee in µUSD: 599 + 500_000 = 500_599
    // 8. Convert to lamports: 500_599 * LAMPORTS_PER_SOL / 20_000_000 = 25_029_950

    assert_eq!(fee, 25_029_750);
}
