# Stable

## Project Overview
Currently there's three sub-projects in this monorepo:
- cctpr (`contracts/cctpr`): An on-chain relaying protocol built on top of cctpv1, v2 and avax hop
- cctp-sdk (`packages/cctp-sdk/*`): Robust low-level SDK for interacting with CCTP, CCTPv2 and CCTPR.
- stable-sdk (`packages/stable-sdk`): High-level interface exposing cctpr (and other protocols to come) with a focus on developer ergonomics.
Se more info the README file for each workspace.

## Getting Started:

1. Set up your environment by following the instructions in each app/package. In particular:

  - [Front end application](./apps/front-end/README.md)
  - [Back end application](./apps/back-end/README.md)
  - [Stable SDK](./packages/stable-sdk/README.md)

2. Install dependencies and build project:

```shell
corepack enable # enable yarn. Only required first time.
yarn install --immutable # install dependencies
yarn build # builds every package
```

3. Run examples:

```shell
yarn workspace @stable-io/sdk tsx examples/executeRoute.ts
```



