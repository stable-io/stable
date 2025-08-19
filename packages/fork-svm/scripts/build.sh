#!/bin/bash

set -euo pipefail

rm -rf temp-litesvm
git clone --depth 1 https://github.com/LiteSVM/litesvm.git temp-litesvm
cd temp-litesvm/crates/node-litesvm && yarn install && yarn run build
cd ../../..
mkdir -p ./src/liteSvm
cp -r temp-litesvm/crates/node-litesvm/litesvm/{internal.*,litesvm.*.node} ./src/liteSvm/
rm -rf temp-litesvm
