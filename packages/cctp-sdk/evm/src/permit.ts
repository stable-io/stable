// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Layout, serialize, deserialize, DeriveType } from "binary-layout";
import type { KindWithAtomic } from "@stable-io/amount";
import { Amount } from "@stable-io/amount";
import type { DomainsOf, Network } from "@stable-io/cctp-sdk-definitions";
import {
  hashItem,
  uint256Item,
  chainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import type { TODO } from "@stable-io/utils";
import { keccak256, encoding } from "@stable-io/utils";
import type { RoTuple, RoArray, TupleWithLength, HeadTail, Simplify } from "@stable-io/map-utils";
import { EvmAddress } from "./address.js";
import type { EvmClient, CallData, Eip2612Data } from "./platform.js";
import {
  wordSize,
  selectorItem,
  evmAddressItem,
  paddedSlotItem,
  abiEncodedBytesItem,
} from "./layoutItems.js";
import { dateToUnixTimestamp } from "./utils.js";

// ---- EIP-712 ----

const domainSeparatorFields = [
  { name: "name",              type: "string"  },
  { name: "version",           type: "string"  },
  { name: "chainId",           type: "uint256" },
  { name: "verifyingContract", type: "address" },
  { name: "salt",              type: "bytes32" },
] as const;
type DomainSeparatorField = typeof domainSeparatorFields[number];
type DomainSeparatorFieldName = DomainSeparatorField["name"];

const associatedLayoutItem = {
  name:              hashItem,
  version:           hashItem,
  chainId:           uint256Item,
  verifyingContract: paddedSlotItem(evmAddressItem),
  salt:              hashItem,
} as const satisfies Record<DomainSeparatorFieldName, Layout>;

const typeString = (fields: RoArray<DomainSeparatorFieldName>) =>
  "EIP712Domain("
  + (domainSeparatorFields
    .filter(dsf => fields.includes(dsf.name))
    .map(dsf => `${dsf.type} ${dsf.name}`)
    .join(","))
  + ")";

const hashString = (s: string) => keccak256(encoding.bytes.encode(s));
const typeHash = (fields: RoArray<DomainSeparatorFieldName>) => hashString(typeString(fields));

type SeparatorLayoutImpl<
  F extends DomainSeparatorFieldName,
  DSF extends RoTuple<DomainSeparatorField> = typeof domainSeparatorFields,
> =
  DSF extends HeadTail<DSF, infer H, infer T>
  ? H["name"] extends F
    ? [ Simplify<{ name: H["name"] } & typeof associatedLayoutItem[H["name"]]>,
      ...SeparatorLayoutImpl<F, T>,
    ]
    : SeparatorLayoutImpl<F, T>
  : [];

const typeHashItem = (fields: RoArray<DomainSeparatorFieldName>) =>
  ({ name: "typeHash", binary: "bytes", custom: typeHash(fields), omit: true } as const);

type SeparatorLayout<F extends DomainSeparatorFieldName> =
  readonly [ReturnType<typeof typeHashItem>, ...SeparatorLayoutImpl<F>];

const separatorLayout =
  <const F extends RoArray<DomainSeparatorFieldName>>(fields: F): SeparatorLayout<F[number]> => [
    typeHashItem(fields),
    ...fields.map(f => ({ name: f, ...associatedLayoutItem[f] })),
  ] as any;

const matchesHash =
  <const L extends Layout>(layout: L, candidate: DeriveType<L>, expected: Uint8Array) =>
    encoding.bytes.equals(keccak256(serialize(layout, candidate)), expected);

//For signing a permit, one has to specify all the components that go into the domain separator.
//The name, chainId, and verifyingContract fields of the domain separator are as one would expect
//  the name of the token, the chainId of the chain where it is deployed, and the address of the
//  token contract itself respectively, as one would expect.
//  The version however can be any string that can't be queried by default (usdc exposes a version()
//  function which currently returns "2" but there's no guarantee of such a function existing on
//  other token contracts).
//So we try to guess the version by trying some likely numeric values and checking whether it
//  matches the domain separator hash that we get from the contract.
const versionedLayout = separatorLayout(["name", "version", "chainId", "verifyingContract"]);
const guessDomainSeparatorVersion = (
  known: Simplify<Omit<DeriveType<typeof versionedLayout>, "version">>,
  domainSeparator: Uint8Array,
) => {
  //we start with 2n because usdc uses 2, then proceed with 1n because it's the most likely a priori
  for (const version of ["2", "1", "0", "3", "4"])
    if (matchesHash(
      versionedLayout,
      { ...known, version: hashString(version) },
      domainSeparator,
    ))
      return version;

  throw new Error("Could not determine domain separator version");
};

const unversionedLayout = separatorLayout(["name", "chainId", "verifyingContract"]);
function determineEip712Domain(
  name: string,
  contract: EvmAddress,
  chainId: bigint,
  domainSeparator: Uint8Array,
) {
  const known = { name: hashString(name), chainId, verifyingContract: contract } as const;
  return {
    name,
    ...(matchesHash(unversionedLayout, known, domainSeparator)
      ? {}
      : { version: guessDomainSeparatorVersion(known, domainSeparator) }
    ),
    chainId,
    verifyingContract: contract.unwrap(),
  } as const;
}

// ---- EIP-2612 ----

const maxUint256 = 2n ** 256n - 1n;

export const composePermitMsg = <N extends Network, D extends DomainsOf<"Evm">>(
  network: N,
) => async function (
  client: EvmClient<N, D>,
  token: EvmAddress,
  owner: EvmAddress,
  spender: EvmAddress,
  value: Amount<KindWithAtomic>,
  deadline: Date | "infinity" = "infinity",
) {
  if (value.toUnit("atomic") <= 0n)
    throw new Error("Value must be positive");

  const ownerItem = {
    name: "owner", binary: "bytes", layout: paddedSlotItem(evmAddressItem),
  } as const;
  const rpcCalls = [
    [[selectorItem("name()")],                     {}       ],
    [[selectorItem("DOMAIN_SEPARATOR()")],         {}       ],
    [[selectorItem("nonces(address)"), ownerItem], { owner }],
  ] as const;

  const [rawName, domainSeparator, rawNonce] =
    await Promise.all(rpcCalls.map(([calldataLayout, params]) =>
      client.ethCall({
        to: token,
        data: serialize(calldataLayout, params) as CallData,
      }),
    )) as TupleWithLength<Uint8Array, typeof rpcCalls["length"]>;

  if (domainSeparator.length !== wordSize)
    throw new Error(`DomainSeparator has length ${domainSeparator.length}, should be ${wordSize}`);

  const name = encoding.bytes.decode(deserialize(abiEncodedBytesItem(), rawName));
  const nonce = deserialize(uint256Item, rawNonce);

  const chainId = chainIdOf(network, client.domain as TODO);
  const domain = determineEip712Domain(name, token, chainId, domainSeparator);

  return {
    types: {
      EIP712Domain: domainSeparatorFields.filter(f => f.name in domain),
      Permit: [
        { name: "owner",    type: "address" },
        { name: "spender",  type: "address" },
        { name: "value",    type: "uint256" },
        { name: "nonce",    type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain,
    message: {
      owner: owner.unwrap(),
      spender: spender.unwrap(),
      value: value.toUnit("atomic"),
      nonce,
      deadline: deadline === "infinity" ? maxUint256 : dateToUnixTimestamp(deadline),
    },
  } as const satisfies Eip2612Data;
};

export const init = <N extends Network>(network: N) => ({
  composePermitMsg: composePermitMsg(network),
} as const);
