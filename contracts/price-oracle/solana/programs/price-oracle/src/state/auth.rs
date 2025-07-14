use anchor_lang::prelude::*;

/// A badge indicating that an admin account is authorized.
#[account]
#[derive(InitSpace)]
pub struct AuthBadgeState {
    pub address: Pubkey,
    pub is_admin: bool,
}

impl AuthBadgeState {
    /// Value `b"authbadge"`.
    pub const SEED_PREFIX: &'static [u8] = b"authbadge";

    pub fn is_admin(&self, account: &impl Key) -> bool {
        self.address == account.key() && self.is_admin
    }

    pub fn is_assistant(&self, account: &impl Key) -> bool {
        self.address == account.key()
    }
}
