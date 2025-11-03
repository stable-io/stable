#!/usr/bin/bash

set -euo pipefail
cd "$(dirname "$0")"

echo "Building Solana CCTPR contracts..."

if [ "${ENV:-}" != "Testnet" ] && [ "${ENV:-}" != "Mainnet" ]; then
  echo "ENV must be Testnet or Mainnet"
  exit 1
fi

docker build -t solana-verify-cctpr -f Dockerfile ../../
solana-verify build -b solana-verify-cctpr -- --features ${ENV,,}
