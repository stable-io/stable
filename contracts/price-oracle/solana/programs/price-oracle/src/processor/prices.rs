use crate::{
    error::PriceOracleError,
    state::{AuthBadgeState, PricesState, PricesStatePlatform},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(chain_id: u16)]
pub struct RegisterPrices<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// Proof that the signer is authorized.
    #[account(constraint = &auth_badge.is_assistant(&signer) @ PriceOracleError::AuthorizedOnly)]
    pub auth_badge: Account<'info, AuthBadgeState>,

    /// The prices for the given chain ID.
    #[account(
        init,
        payer = signer,
        space = 8 + PricesState::INIT_SPACE,
        seeds = [PricesState::SEED_PREFIX, chain_id.to_be_bytes().as_ref()],
        bump
    )]
    pub prices: Account<'info, PricesState>,

    pub system_program: Program<'info, System>,
}

pub fn register_evm_prices(
    ctx: Context<RegisterPrices>,
    chain_id: u16,
    gas_token_price: u64,
    gas_price: u32,
    price_per_tx_byte: u32,
) -> Result<()> {
    require!(
        crate::utils::Platform::from_chain_id(chain_id) == Some(crate::utils::Platform::Evm),
        PriceOracleError::InvalidChainId
    );

    ctx.accounts.prices.set_inner(PricesState {
        chain_id,
        gas_token_price,
        prices: PricesStatePlatform::Evm {
            gas_price,
            price_per_tx_byte,
        },
    });

    Ok(())
}

pub fn register_sui_prices(
    ctx: Context<RegisterPrices>,
    chain_id: u16,
    gas_token_price: u64,
    computation_unit_price: u32,
    byte_price: u32,
    rebate_ratio: u8,
) -> Result<()> {
    require!(
        crate::utils::Platform::from_chain_id(chain_id) == Some(crate::utils::Platform::Sui),
        PriceOracleError::InvalidChainId
    );

    ctx.accounts.prices.set_inner(PricesState {
        chain_id,
        gas_token_price,
        prices: PricesStatePlatform::Sui {
            computation_unit_price,
            byte_price,
            rebate_ratio,
        },
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdatePrices<'info> {
    pub signer: Signer<'info>,

    /// Proof that the signer is authorized.
    #[account(constraint = &auth_badge.is_assistant(&signer) @ PriceOracleError::AuthorizedOnly)]
    pub auth_badge: Account<'info, AuthBadgeState>,

    /// The prices for the given chain ID.
    #[account(mut)]
    pub prices: Account<'info, PricesState>,
}

pub fn update_evm_prices(
    ctx: Context<UpdatePrices>,
    new_gas_token_price: u64,
    new_gas_price: u32,
    new_price_per_tx_byte: u32,
) -> Result<()> {
    ctx.accounts.prices.gas_token_price = new_gas_token_price;

    let PricesStatePlatform::Evm {
        gas_price,
        price_per_tx_byte,
    } = &mut ctx.accounts.prices.prices
    else {
        return Err(PriceOracleError::InvalidChainId.into());
    };

    *gas_price = new_gas_price;
    *price_per_tx_byte = new_price_per_tx_byte;

    Ok(())
}

pub fn update_sui_prices(
    ctx: Context<UpdatePrices>,
    new_computation_unit_price: u32,
    new_gas_token_price: u64,
) -> Result<()> {
    ctx.accounts.prices.gas_token_price = new_gas_token_price;

    let PricesStatePlatform::Sui {
        computation_unit_price,
        ..
    } = &mut ctx.accounts.prices.prices
    else {
        return Err(PriceOracleError::InvalidChainId.into());
    };

    *computation_unit_price = new_computation_unit_price;

    Ok(())
}

pub fn update_sui_byte_price(ctx: Context<UpdatePrices>, new_byte_price: u32) -> Result<()> {
    let PricesStatePlatform::Sui { byte_price, .. } = &mut ctx.accounts.prices.prices else {
        return Err(PriceOracleError::InvalidChainId.into());
    };

    *byte_price = new_byte_price;

    Ok(())
}

pub fn update_sui_rebate_ratio(ctx: Context<UpdatePrices>, new_rebate_ratio: u8) -> Result<()> {
    let PricesStatePlatform::Sui { rebate_ratio, .. } = &mut ctx.accounts.prices.prices else {
        return Err(PriceOracleError::InvalidChainId.into());
    };

    *rebate_ratio = new_rebate_ratio;

    Ok(())
}
