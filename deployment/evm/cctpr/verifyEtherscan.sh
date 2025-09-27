#!/bin/bash

set -euo pipefail

# Check if ENV is set
if [ -z "$ENV" ]; then
    echo "Error: ENV environment variable is not set"
    echo "Please set ENV to a valid environment (e.g: mainnet, testnet)"
    exit 1
fi

# Check if ETHERSCAN_API_KEY is set
if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "Error: ETHERSCAN_API_KEY environment variable is not set"
    echo "Please set ETHERSCAN_API_KEY to your Etherscan API key"
    exit 1
fi

echo "Using environment: $ENV"
echo ""

yarn tsx src/scripts/verifyEtherscan.ts 2>/dev/null | while read -r line
do
   cd ../../../contracts/cctpr/evm
   echo "Executing: $line"
   echo ""
   eval "$line"
   echo "--------------------------------"
   echo ""
done
