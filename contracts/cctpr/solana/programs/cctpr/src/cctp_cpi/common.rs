use anchor_lang::prelude::*;

//see:
// * https://developers.circle.com/stablecoins/solana-programs

pub mod v1 {
  use super::*;

  pub const MESSAGE_TRANSMITTER_PROGRAM_ID: Pubkey =
    pubkey!("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd");

  pub const TOKEN_MESSENGER_MINTER_PROGRAM_ID: Pubkey =
    pubkey!("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");
}

pub mod v2 {
  use super::*;

  pub const MESSAGE_TRANSMITTER_PROGRAM_ID: Pubkey =
    pubkey!("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC");

  pub const TOKEN_MESSENGER_MINTER_PROGRAM_ID: Pubkey =
    pubkey!("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
}
