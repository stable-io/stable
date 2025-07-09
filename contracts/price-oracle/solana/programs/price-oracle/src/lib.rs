pub mod error;
pub mod id;
pub mod int;
pub mod processor;
pub mod state;
pub mod utils;

pub use id::ID;

use anchor_lang::prelude::*;
use processor::*;

#[constant]
pub const SEED_PREFIX_UPGRADE_LOCK: &[u8] = b"upgrade_lock";

#[derive(Debug, Clone)]
pub struct PriceOracle;

impl Id for PriceOracle {
    fn id() -> Pubkey {
        ID
    }
}

#[program]
pub mod solana_price_oracle {
    use super::*;

    pub fn initialize<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, Initialize<'info>>,
        admins: Vec<Pubkey>,
        assistants: Vec<Pubkey>,
    ) -> Result<()> {
        processor::initialize(ctx, admins, assistants)
    }

    /* Accounts ownership */

    /// Updates the owner account. This needs to be either cancelled or approved.
    ///
    /// # Authorized
    ///
    /// - Owner
    pub fn submit_owner_role_transfer_request(
        ctx: Context<SubmitOwnerTransfer>,
        new_owner: Pubkey,
    ) -> Result<()> {
        processor::submit_owner_role_transfer_request(ctx, new_owner)
    }

    /// The new owner confirms to be so.
    ///
    /// # Authorized
    ///
    /// - New Owner
    pub fn confirm_owner_role_transfer_request(ctx: Context<ConfirmOwnerTransfer>) -> Result<()> {
        processor::confirm_owner_role_transfer_request(ctx)
    }

    /// The owner role transfer is cancelled by the current one.
    ///
    /// # Authorized
    ///
    /// - Owner
    pub fn cancel_owner_role_transfer_request(ctx: Context<CancelOwnerTransfer>) -> Result<()> {
        processor::cancel_owner_role_transfer_request(ctx)
    }

    /// Adds a new admin account.
    ///
    /// # Authorized
    ///
    /// - Owner
    pub fn add_admin_role(ctx: Context<AddAdmin>, new_admin: Pubkey) -> Result<()> {
        processor::add_admin_role(ctx, new_admin)
    }

    /// Removes an admin account.
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    pub fn remove_admin_role(ctx: Context<RemoveAdmin>) -> Result<()> {
        processor::remove_admin_role(ctx)
    }

    /// Adds a new assistant account.
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    pub fn add_assistant_role(ctx: Context<AddAssistant>, new_assistant: Pubkey) -> Result<()> {
        processor::add_assistant_role(ctx, new_assistant)
    }

    /// Removes an assistant account.
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    pub fn remove_assistant_role(ctx: Context<RemoveAssistant>) -> Result<()> {
        processor::remove_assistant_role(ctx)
    }

    /* Prices */

    /// Update the Solana price, in μusd/SOL.
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    /// - Assistant
    pub fn update_sol_price(ctx: Context<UpdateSolPrice>, new_sol_price: u64) -> Result<()> {
        processor::update_sol_price(ctx, new_sol_price)
    }

    /// Register the prices for a new EVM chain, with the initial prices:
    ///
    /// - `gas_price`: Mwei/gas
    /// - `price_per_tx_byte`: Mwei/byte
    /// - `gas_token_price`: μusd/Mwei
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    /// - Assistant
    pub fn register_evm_prices(
        ctx: Context<RegisterPrices>,
        chain_id: u16,
        gas_token_price: u64,
        gas_price: u32,
        price_per_tx_byte: u32,
    ) -> Result<()> {
        processor::register_evm_prices(ctx, chain_id, gas_token_price, gas_price, price_per_tx_byte)
    }

    /// Update prices for an already registered EVM chain.
    ///
    /// - `gas_price`: Mwei/gas
    /// - `price_per_tx_byte`: Mwei/byte
    /// - `gas_token_price`: μusd/Mwei
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    /// - Assistant
    pub fn update_evm_prices(
        ctx: Context<UpdatePrices>,
        gas_token_price: u64,
        gas_price: u32,
        price_per_tx_byte: u32,
    ) -> Result<()> {
        processor::update_evm_prices(ctx, gas_token_price, gas_price, price_per_tx_byte)
    }

    /// Register the prices for the Sui chain, with the initial prices:
    ///
    /// - `gas_token_price`: μusd/SUI
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    /// - Assistant
    pub fn register_sui_prices(
        ctx: Context<RegisterPrices>,
        chain_id: u16,
        gas_token_price: u64,
        computation_unit_price: u32,
        byte_price: u32,
        rebate_ratio: u8,
    ) -> Result<()> {
        processor::register_sui_prices(
            ctx,
            chain_id,
            gas_token_price,
            computation_unit_price,
            byte_price,
            rebate_ratio,
        )
    }

    /// Update the prices for the Sui chain.
    ///
    /// - `gas_token_price`: μusd/SUI
    ///
    /// # Authorized
    ///
    /// - Owner
    /// - Admin
    /// - Assistant
    pub fn update_sui_prices(
        ctx: Context<UpdatePrices>,
        gas_token_price: u64,
        computation_unit_price: u32,
    ) -> Result<()> {
        processor::update_sui_prices(ctx, computation_unit_price, gas_token_price)
    }

    pub fn update_sui_byte_price(ctx: Context<UpdatePrices>, byte_price: u32) -> Result<()> {
        processor::update_sui_byte_price(ctx, byte_price)
    }

    pub fn update_sui_rebate_ratio(ctx: Context<UpdatePrices>, rebate_ratio: u8) -> Result<()> {
        processor::update_sui_rebate_ratio(ctx, rebate_ratio)
    }
}
