// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { RoTuple, RoArray } from "@stable-io/map-utils";
import type { Rationalish, Kind, KindWithAtomic, SymbolsOf } from "@stable-io/amount";
import { Amount, Rational } from "@stable-io/amount";
import type { Item, CustomConversion, FixedConversion, NumberSize } from "binary-layout";
import { numberMaxSize } from "binary-layout";
import { UniversalAddress } from "./address.js";
import type { Domain, SimplifyDomain } from "./constants/chains/index.js";
import { domains, domainOf, domainIdOf } from "./constants/chains/index.js";
import { DistributiveAmount } from "./constants/kinds.js";
import { encoding } from "@stable-io/utils";

export const uint256Item = {
  binary: "uint", size: 32,
} as const satisfies Item;

export const hashItem = {
  binary: "bytes", size: 32,
} as const satisfies Item;

export const universalAddressItem = {
  binary: "bytes",
  size: UniversalAddress.byteSize,
  custom: {
    to: (encoded: Uint8Array) => new UniversalAddress(encoded),
    from: (addr: UniversalAddress) => addr.toUint8Array(),
  } satisfies CustomConversion<Uint8Array, UniversalAddress>,
} as const satisfies Item;

export const signatureItem = {
  binary: "bytes", size: 65,
} as const satisfies Item;

export const rawDomainItem = {
  binary: "uint", size: 4,
} as const satisfies Item;

// ----

export const domainItem = <
  const DT extends RoTuple<Domain> = typeof domains,
>(domainTuple?: DT) => ({
  ...rawDomainItem,
  custom: {
    to: (val: number): SimplifyDomain<DT[number]> => {
      const domain = domainOf.get(val);
      if (domain === undefined)
        throw new Error(`unknown domainId ${val}`);

      if (domainTuple && !(domainTuple as RoArray<Domain>).includes(domain))
        throw new Error(`Domain ${domain} not in domains ${domainTuple}`);

      return domain as SimplifyDomain<DT[number]>;
    },
    from: (val: SimplifyDomain<DT[number]>): number => domainIdOf(val),
  } satisfies CustomConversion<number, SimplifyDomain<DT[number]>>,
} as const);

export const fixedDomainItem = <const D extends Domain>(domain: D) => ({
  ...rawDomainItem,
  custom: {
    to: domain,
    from: domainIdOf(domain),
  } satisfies FixedConversion<number, D>,
} as const);

// ----

type NumericType<S extends number> = S extends NumberSize ? number : bigint;
type AmountReturnItem<S extends number, K extends Kind> = {
  binary: "uint";
  size: S;
  custom: CustomConversion<NumericType<S>, DistributiveAmount<K>>;
};
type TransformFunc<S extends number> = {
  to: (val: NumericType<S>) => Rationalish;
  from: (val: Rational) => NumericType<S>;
};
type SizedTransformFunc<S extends number> = (size: S) => TransformFunc<S>;

function numericReturn<S extends number>(size: S): TransformFunc<S>["from"] {
  return size > numberMaxSize
    ? (val: Rational) => val.floor() as NumericType<S>
    : (val: Rational) => encoding.bignum.toNumber(val.floor()) as NumericType<S>;
}

//conversion happens in 3 stages:
// 1. raw value is read from layout
// 2. then it is optionally transformed (e.g. scaled/multiplied/etc.)
// 3. finally it is converted into an amount of the given kind and unit
//and likewise but inverted for the opposite direction
export function amountItem<S extends number, const K extends KindWithAtomic>(
  size: S,
  kind: K,
  unitSymbolOrTransform?: SymbolsOf<K> | TransformFunc<S> | SizedTransformFunc<S>,
): AmountReturnItem<S, K>;
export function amountItem<S extends number, const K extends Kind>(
  size: S,
  kind: K,
  unitSymbol: SymbolsOf<K>,
  transform?: TransformFunc<S> | SizedTransformFunc<S>,
): AmountReturnItem<S, K>;
export function amountItem<S extends number, const K extends Kind>(
  size: S,
  kind: K,
  unitSymbolOrTransform?: SymbolsOf<K> | TransformFunc<S> | SizedTransformFunc<S>,
  transform?: TransformFunc<S> | SizedTransformFunc<S>,
): AmountReturnItem<S, K> {
  let unitSymbol: SymbolsOf<K> | undefined;
  if (transform)
    unitSymbol = unitSymbolOrTransform as SymbolsOf<K>;
  else if (typeof unitSymbolOrTransform === "string")
    unitSymbol = unitSymbolOrTransform;
  else if (unitSymbolOrTransform)
    transform = unitSymbolOrTransform;

  if (unitSymbol === undefined || unitSymbol === "atomic")
    unitSymbol = kind.atomic as SymbolsOf<K>;

  if (typeof transform === "function")
    transform = transform(size);

  const toFunc = (val: Rationalish): DistributiveAmount<K> =>
    Amount.from(val, kind, unitSymbol) as DistributiveAmount<K>;

  const custom = transform === undefined
    ? {
      to: (val: NumericType<S>) =>
        toFunc(val),
      from: (amount: DistributiveAmount<K>): NumericType<S> =>
        numericReturn(size)(amount.toUnit(unitSymbol) as Rational)
    }
    : {
      to: (val: NumericType<S>) =>
        toFunc(transform.to(val)),
      from: (amount: DistributiveAmount<K>): NumericType<S> =>
        transform.from(amount.toUnit(unitSymbol) as Rational)
    };

  return { binary: "uint", size, custom };
}

export function linearTransform<S extends number>(
  direction: "to->from" | "from->to",
  coefficient: Rationalish,
  constant?: Rationalish,
): SizedTransformFunc<S> {
  coefficient = Rational.from(coefficient);
  constant = Rational.from(constant ?? 0);
  return (size: S) => {
    const numRet = numericReturn(size);  
    return direction === "to->from"
      ? {
        to: (val: NumericType<S>) => Rational.from(val).mul(coefficient).add(constant),
        from: (val: Rational) => numRet(val.sub(constant).div(coefficient)),
      }
      : {
        to: (val: NumericType<S>) => Rational.from(val).sub(constant).div(coefficient),
        from: (val: Rational) => numRet(val.mul(coefficient).add(constant)),
      };
  }
}
