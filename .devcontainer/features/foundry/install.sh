#!/usr/bin/env bash
set -eu

su vscode -c '
  curl -L https://foundry.paradigm.xyz | bash &&
  ~/.foundry/bin/foundryup
'
