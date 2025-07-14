use anchor_lang::prelude::*;

#[error_code]
pub enum CctprError {
  #[msg("Not authorized")]
  NotAuthorized,

  #[msg("Invalid owner")]
  InvalidOwner,

  #[msg("Invalid pending owner")]
  InvalidPendingOwner,

  #[msg("Invalid fee recipient")]
  InvalidFeeRecipient,

  #[msg("Invalid transfer args")]
  InvalidTransferArgs,

  #[msg("Quote expired")]
  QuoteExpired,

  #[msg("Gasless permission expired")]
  GaslessPermissionExpired,

  #[msg("Offchain quoter signature invalid")]
  OffchainQuoterSignatureInvalid,

  #[msg("Exceeds max fee")]
  ExceedsMaxFee,
}
