#!/usr/bin/bash

set -euo pipefail
cd "$(dirname "$0")"

if [ "${ENV:-}" != "Testnet" ] && [ "${ENV:-}" != "Mainnet" ]; then
  echo "ENV must be Testnet or Mainnet"
  exit 1
fi

SOLANA_CONTRACTS_DIR=../../../contracts/cctpr/solana
OUTPUT_DIR=./build-program/${ENV}

yarn tsx setProgramId.ts
bash ${SOLANA_CONTRACTS_DIR}/build.sh
mkdir -p ${OUTPUT_DIR}
cp ${SOLANA_CONTRACTS_DIR}/target/deploy/cctpr.so ${OUTPUT_DIR}
