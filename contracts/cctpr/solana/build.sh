#!/usr/bin/bash

set -euo pipefail

echo "Building Solana CCTPR contracts..."

if [ "${ENV:-}" != "testnet" ] && [ "${ENV:-}" != "mainnet" ]; then
  echo "ENV must be testnet or mainnet"
  exit 1
fi

docker build -t solana-verify-cctpr -f Dockerfile ../../
solana-verify build -b solana-verify-cctpr -- --features ${ENV}
mkdir -p target/deploy/${ENV}
cp target/deploy/cctpr.so target/deploy/${ENV}
