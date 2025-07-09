use anchor_lang::prelude::error_code;

#[error_code]
pub(crate) enum PriceOracleError {
    /// The number of admin and assistant accounts passed as arguments in `initialize` must match
    /// the number of badges in `remaining_accounts`.
    #[msg("AdminsAndAssistantsCountMismatch")]
    AdminsAndAssistantsCountMismatch,

    /// Only the program's owner is permitted.
    #[msg("OwnerOnly")]
    OwnerOnly,

    /// Only the program's owner or admin are permitted.
    #[msg("OwnerOrAdminOnly")]
    OwnerOrAdminOnly,

    /// Only the program's owner, admin or assistant are permitted.
    #[msg("AuthorizedOnly")]
    AuthorizedOnly,

    /// Only the program's pending owner is permitted.
    #[msg("PendingOwnerOnly")]
    PendingOwnerOnly,

    /// Specified key is already the program's owner.
    #[msg("AlreadyTheOwner")]
    AlreadyTheOwner,

    /// The owner badge can't be deleted via RemoveAdmin.
    #[msg("OwnerDeletionForbidden")]
    OwnerDeletionForbidden,

    /// Can remove an assistant badge only.
    #[msg("AssistantDeletionOnly")]
    AssistantDeletionOnly,

    /// The provided chain ID does not match the called method, or the Solana chain ID was provided.
    #[msg("InvalidChainId")]
    InvalidChainId,

    /// Overflow occurred during a calculation.
    #[msg("Overflow")]
    Overflow,

    /// Division by zero occurred during a calculation.
    #[msg("DivisionByZero")]
    DivisionByZero,
}
