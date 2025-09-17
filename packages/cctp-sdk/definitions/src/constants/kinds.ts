// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Kind, KindWithHuman, KindWithAtomic, Rationalish } from "@stable-io/amount";
import { Rational, Amount } from "@stable-io/amount";
import type { Domain } from "./chains/domains.js";
import type { MapLevel, Column } from "@stable-io/map-utils";
import { constMap } from "@stable-io/map-utils";

const unit = <const T, const U>(symbol: T, scale: U) => ({ symbol, scale } as const);
const oom = (order: number) => order < 0
  ? Rational.from(1n, 10n**BigInt(-order))
  : 10n**BigInt(order);

export const Percentage = {
  name: "Percentage",
  human: "%",
  units: [
    unit("scalar", 1),
    unit("%", oom(-2)),
    unit("bp", oom(-4)),
  ],
} as const satisfies Kind;
export type Percentage = Amount<typeof Percentage>;
export const percentage = Amount.ofKind(Percentage);

export const mulPercentage =
  <K extends Kind>(amount: Amount<K>, percentage: Percentage): Amount<K> =>
    amount.mul(percentage.toUnit("scalar"));

export const Duration = {
  name: "Duration",
  units: [
    unit("sec", 1),
    unit("min", 60),
    unit("hr", 60*60),
    unit("day", 60*60*24),
    unit("msec", oom(-3)),
    unit("µsec", oom(-6)),
    unit("nsec", oom(-9)),
  ],
  //TODO more readable stringify
} as const satisfies Kind;
export type Duration = Amount<typeof Duration>;
export const duration = Amount.ofKind(Duration);

export const Gas = {
  name: "Gas",
  human: "gas",
  atomic: "gas",
  units: [unit("gas", 1n)],
} as const satisfies Kind;
export type Gas = Amount<typeof Gas>;
export const gas = Amount.ofKind(Gas);

export const ComputeUnit = {
  name: "ComputeUnit",
  human: "CU",
  atomic: "CU",
  units: [unit("CU", 1n)],
} as const satisfies Kind;
export type ComputeUnit = Amount<typeof ComputeUnit>;
export const computeUnit = Amount.ofKind(ComputeUnit);

export const Byte = {
  name: "Byte",
  //In a general use case, there probably shouldn't be a human unit type because specifying
  //  e.g. HDD sizes in bytes is very much not human.
  //But given our context, we are almost exclusively dealing with amounts < 1 kB and so this choice
  //  ought to be reasonable.
  human: "byte",
  atomic: "byte",
  units: [
    unit("byte", 1n),
    unit("kB", oom(3)),
    unit("MB", oom(6)),
    unit("KiB", 1024n),
    unit("MiB", 1024n**2n),
  ],
} as const satisfies Kind;
export type Byte = Amount<typeof Byte>;
export const byte = Amount.ofKind(Byte);

//for now, we don't make a distinction between usd and usdc
const Usd = {
  name: "Usd",
  units: [unit("$", 1n), unit("¢", oom(-2))],
  human:  "$",
  atomic: "¢",
  stringify: function (val: Rational) {
    return val.ge(1)
      ? `$${val.eq(val.floor()) ? val.toString() : val.toFixed(2)}`
      : `${val.mul(100).toString()}¢`;
  },
} as const satisfies Kind;
export type Usd = Amount<typeof Usd>;
export const usd = Amount.ofKind(Usd);

export const Usdc = {
  name: "Usdc",
  units: [unit("USDC", 1), unit("µUSDC", oom(-6))],
  human: "USDC",
  atomic: "µUSDC",
  stringify: function (val: Rational) {
    return val.ge(oom(-2))
      ? `${val.eq(val.floor()) ? val.toString() : val.toFixed(2)} USDC`
      : `${val.div(oom(-6)).toString()} µUSDC`;
  },
} as const satisfies Kind;
export type Usdc = Amount<typeof Usdc>;
export const usdc = Amount.ofKind(Usdc);
export const isUsdc = (amount: Usdc | Amount<Kind>): amount is Usdc =>
  amount.kind.name === "Usdc";

//generic type to refer to arbitrary gas tokens where atomic amount is unknown
export const GenericGasToken = {
  name: "GasToken",
  units: [
    unit("GasToken", 1n),
    unit("mGasToken", oom(-3)),
    unit("µGasToken", oom(-6)),
    unit("nGasToken", oom(-9)),
    unit("aGasToken", oom(-18)),
  ],
  human: "GasToken",
} as const satisfies Kind;
export type GenericGasToken = Amount<typeof GenericGasToken>;
export const genericGasToken = Amount.ofKind(GenericGasToken);

//generic type to refer to Evm gas tokens in particular, which always have 18 decimals
export const EvmGasToken = {
  name: "EvmGasToken",
  units: [
    unit("EvmGasToken", 1n),
    unit("nEvmGasToken", oom(-9)),
    unit("aEvmGasToken", oom(-18)),
  ],
  human: "EvmGasToken",
  atomic: "aEvmGasToken",
} as const satisfies Kind;
export type EvmGasToken = Amount<typeof EvmGasToken>;
export const evmGasToken = Amount.ofKind(EvmGasToken);

export const Eth = {
  name: "Eth",
  units: [unit("ETH", 1n), unit("Gwei", oom(-9)), unit("wei", oom(-18))],
  human:  "ETH",
  atomic: "wei",
} as const satisfies Kind;
export type Eth = Amount<typeof Eth>;
export const eth = Amount.ofKind(Eth);

export const Avax = {
  name: "Avax",
  units: [unit("AVAX", 1n), unit("nAVAX", oom(-9)), unit("aAVAX", oom(-18))],
  human: "AVAX",
  atomic: "aAVAX",
} as const satisfies Kind;
export type Avax = Amount<typeof Avax>;
export const avax = Amount.ofKind(Avax);

export const Pol = {
  name: "Pol",
  units: [unit("POL", 1n), unit("Gwei", oom(-9)), unit("wei", oom(-18))],
  human:  "POL",
  atomic: "wei",
} as const satisfies Kind;
export type Pol = Amount<typeof Pol>;
export const pol = Amount.ofKind(Pol);

export const Sonic = {
  name: "Sonic",
  units: [unit("S", 1n), unit("Gwei", oom(-9)), unit("wei", oom(-18))],
  human:  "S",
  atomic: "wei",
} as const satisfies Kind;
export type Sonic = Amount<typeof Sonic>;
export const sonic = Amount.ofKind(Sonic);

export const Sol = {
  name: "Sol",
  units: [unit("SOL", 1n), unit("lamports", oom(-9)), unit("µlamports", oom(-15))],
  human: "SOL",
  atomic: "lamports",
} as const satisfies Kind;
export type Sol = Amount<typeof Sol>;
export const sol = Amount.ofKind(Sol);

export const Sui = {
  name: "Sui",
  units: [unit("SUI", 1n), unit("MIST", oom(-9))],
  human: "SUI",
  atomic: "MIST",
} as const satisfies Kind;
export type Sui = Amount<typeof Sui>;
export const sui = Amount.ofKind(Sui);

export const Apt = {
  name: "Apt",
  units: [unit("APT", 1n), unit("Octas", oom(-8))],
  human: "APT",
  atomic: "Octas",
} as const satisfies Kind;
export type Apt = Amount<typeof Apt>;
export const apt = Amount.ofKind(Apt);

//TODO introduce type aliasing like for domains to deal with large, ugly kind types

export const nameKindAmountEntries = [
  ["Percentage",      [Percentage,      percentage     ]],
  ["Duration",        [Duration,        duration       ]],
  ["Gas",             [Gas,             gas            ]],
  ["ComputeUnit",     [ComputeUnit,     computeUnit    ]],
  ["Byte",            [Byte,            byte           ]],
  ["Usd",             [Usd,             usd            ]],
  ["Usdc",            [Usdc,            usdc           ]],
  ["GenericGasToken", [GenericGasToken, genericGasToken]],
  ["EvmGasToken",     [EvmGasToken,     evmGasToken    ]],
  ["Eth",             [Eth,             eth            ]],
  ["Avax",            [Avax,            avax           ]],
  ["Pol",             [Pol,             pol            ]],
  ["Sonic",           [Sonic,           sonic          ]],
  ["Sol",             [Sol,             sol            ]],
  ["Sui",             [Sui,             sui            ]],
  ["Apt",             [Apt,             apt            ]],
] as const satisfies MapLevel<string, readonly [Kind, unknown]>;
export type NamedKind = Column<typeof nameKindAmountEntries, 0>[number];
const kindAmountOf = constMap(nameKindAmountEntries);
type KindAmountOf<N extends NamedKind> = ReturnType<typeof kindAmountOf<N>>;

//There's an explicit point to going through the name first instead of directly linking domains to
//  their associated kinds and amounts, namely that it avoids duplication of types:
//tsc can automatically deduplicate union types for built-ins like string or number. However, for
//  more complex types like kinds, this is not always possible. Therefore, a direct mapping for
//  something like GasTokenOf<DomainsOf<"Evm">>, the inferred type would contain multiple duplicates
//  of the Eth kind, which makes the already unwieldy type even more bothersome.
//Taking the intermediate step through the name allows collapsing the type to one instance per kind.
export const gasTokenNameEntries = [
  ["Ethereum",   "Eth"  ],
  ["Avalanche",  "Avax" ],
  ["Optimism",   "Eth"  ],
  ["Arbitrum",   "Eth"  ],
  ["Noble",      "Usdc" ],
  ["Solana",     "Sol"  ],
  ["Base",       "Eth"  ],
  ["Polygon",    "Pol"  ],
  ["Sui",        "Sui"  ],
  ["Aptos",      "Apt"  ],
  ["Unichain",   "Eth"  ],
  ["Linea",      "Eth"  ],
  ["Codex",      "Eth"  ],
  ["Sonic",      "Sonic"],
  ["Worldchain", "Eth"  ],
] as const satisfies MapLevel<Domain, NamedKind>;
export const gasTokenNameOf = constMap(gasTokenNameEntries);
export type GasTokenNameOf<D extends Domain> = ReturnType<typeof gasTokenNameOf<D>>;

export type GasTokenKindOf<D extends Domain> =
  //explicitly tell the compiler that any type returned by GasTokenKindOf<D> always has a human
  //  and an atomic representation
  KindAmountOf<GasTokenNameOf<D>>[0] extends infer T extends KindWithHuman & KindWithAtomic
  ? T
  : never;

export type DistributiveAmount<K extends Kind, E extends Kind = Kind> =
  K extends E ? Amount<K> : never;

// WARNING:
//GasTokenOf refers to the Amount, rather than to the "constructor" type that's returned by
//  gasTokenOf. The actual constructor type is provided by GasTokenCtrOf.
//The reason for this deviation is that when we use the `gasTokenOf` mapping directly, we
//  always want to create a gas token amount at runtime.
//However, when we use the `GasTokenOf` type, we are referring to the associated Amount.
//
//E.g. if we want to implement an `addOverhead` function that takes a gas token amount of a given
//  domain and adds a fixed overhead, I'd argue that this is the most intuitive way to write it:
//```
//function addOverhead<D extends Domain>(
//  domain: D,
//  amount: GasTokenOf<D>
//): GasTokenOf<D> {
//  return amount.add(gasTokenOf(domain)(1, "human"));
//}
//```
//Optional secondary parameter allows explicitly telling tsc in generic code about a
//  connection between GasTokenOf<D> and GasTokenOf<E> for some larger domain union E.
export type GasTokenOf<D extends Domain, E extends Domain = Domain> =
  DistributiveAmount<GasTokenKindOf<D>> extends infer R
    extends DistributiveAmount<GasTokenKindOf<E>>
  ? R
  : never;
export type GasTokenCtrOf<D extends Domain> = KindAmountOf<GasTokenNameOf<D>>[1];

export const gasTokenKindOf = <D extends Domain>(d: D): GasTokenKindOf<D> =>
  kindAmountOf(gasTokenNameOf(d))[0] as any;

export const gasTokenOf = <D extends Domain>(d: D): GasTokenCtrOf<D> =>
  kindAmountOf(gasTokenNameOf(d))[1] as any;
