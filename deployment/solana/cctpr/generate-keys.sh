#!/usr/bin/bash

set -euo pipefail
cd "$(dirname "$0")"

if [ "${ENV:-}" != "Testnet" ] && [ "${ENV:-}" != "Mainnet" ]; then
  echo "ENV must be Testnet or Mainnet"
  exit 1
fi

export att_buffer_address=$(solana-keygen grind --ignore-case --starts-with cctpb:1 | grep 'Wrote keypair' | awk '{ sub(/\.json$/, "", $4); print $4 }')
export att_program_address=$(solana-keygen grind --ignore-case --starts-with cctpr:1 | grep 'Wrote keypair' | awk '{ sub(/\.json$/, "", $4); print $4 }')
export att_deployer_address=$(solana-keygen grind --ignore-case --starts-with tmp:1 | grep 'Wrote keypair' | awk '{ sub(/\.json$/, "", $4); print $4 }')

if [ -z "${att_buffer_address}" ]; then
    echo "Couldn't generate keys"
    exit
fi

echo ---------------------------------------------------------------------
echo Created accounts:
echo att_buffer_address=$att_buffer_address
echo att_program_address=$att_program_address
echo att_deployer_address=$att_deployer_address
echo ---------------------------------------------------------------------

export att_buffer_account_keyfile=./$att_buffer_address.json
export att_program_account_keyfile=./$att_program_address.json
export att_deployer_account_keyfile=./$att_deployer_address.json

mkdir -p ./privatekeys/${ENV}
mkdir -p ./config
mv $att_buffer_account_keyfile $att_program_account_keyfile $att_deployer_account_keyfile ./privatekeys/${ENV}
echo "{
  \"cctpr_buffer\": \"$att_buffer_address\",
  \"cctpr_program\": \"$att_program_address\",
  \"cctpr_deployer\": \"$att_deployer_address\"
}" > ./config/${ENV}.json
