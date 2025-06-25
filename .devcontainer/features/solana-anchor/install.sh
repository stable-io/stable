#!/usr/bin/env bash
set -e

# Install Solana - maybe replace stable with v2.1.21
su vscode -c "curl -sSfL https://release.anza.xyz/stable/install | bash"

# Install Anchor
su vscode -c '
  export PATH="/usr/local/cargo/bin:${PATH}:/home/vscode/.avm/bin" &&
  cargo install --git https://github.com/coral-xyz/anchor avm --force &&
  avm install 0.31.1 &&
  avm use 0.31.1
'
