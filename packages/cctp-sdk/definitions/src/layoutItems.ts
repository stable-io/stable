// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { RoTuple, RoArray } from "@stable-io/map-utils";
import type {
  Rationalish,
  Kind,
  KindWithHuman,
  KindWithAtomic,
  SymbolsOf,
} from "@stable-io/amount";
import { Amount, Conversion, Rational } from "@stable-io/amount";
import type { Item, CustomConversion, FixedConversion, NumberSize } from "binary-layout";
import { numberMaxSize } from "binary-layout";
import { UniversalAddress } from "./address.js";
import type { Domain, Network, SimplifyDomain } from "./constants/chains/index.js";
import {
  domains,
  domainOf,
  domainIdOf,
  wormholeChainIdOf,
  domainOfWormholeChainId,
} from "./constants/chains/index.js";
import type { DistributiveAmount } from "./constants/kinds.js";
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

export const rawWormholeChainIdItem = {
  binary: "uint", size: 2,
} as const satisfies Item;

export const paddingItem = (size: number) => ({
  binary: "bytes", custom: new Uint8Array(size), omit: true,
} as const satisfies Item);

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

export const wormholeChainItem = <
  N extends Network,
  const DT extends RoTuple<Domain> = typeof domains,
>(network: N, domainTuple?: DT) => ({
  ...rawWormholeChainIdItem,
  custom: {
    to: (val: number): SimplifyDomain<DT[number]> => {
      const domain = domainOfWormholeChainId.get(network, val);
      if (domain === undefined)
        throw new Error(`unknown domainId ${val}`);

      if (domainTuple && !(domainTuple as RoArray<Domain>).includes(domain))
        throw new Error(`Domain ${domain} not in domains ${domainTuple}`);

      return domain as SimplifyDomain<DT[number]>;
    },
    from: (val: SimplifyDomain<DT[number]>): number =>
      wormholeChainIdOf(network, val as any) as number,
  } satisfies CustomConversion<number, SimplifyDomain<DT[number]>>,
} as const);

// ----

type NumericType<S extends number> =
  S extends NumberSize
  ? number
  : number extends S
  ? number | bigint
  : bigint;

type TransformFunc<S extends number> = {
  to: (val: NumericType<S>) => Rationalish;
  from: (val: Rational) => NumericType<S>;
};

type SizedTransformFunc<S extends number> = (size: S) => TransformFunc<S>;
type TransformFuncUnion<S extends number> = TransformFunc<S> | SizedTransformFunc<S>;

function numericReturn<S extends number>(size: S): TransformFunc<S>["from"] {
  return size > numberMaxSize
    ? (val: Rational) => val.floor() as NumericType<S>
    : (val: Rational) => encoding.bignum.toNumber(val.floor()) as NumericType<S>;
}

type SizedReturnItem<S extends number, T> = {
  binary: "uint";
  size: S;
  custom: CustomConversion<NumericType<S>, T>;
};

type AmountReturnItem<S extends number, K extends Kind> =
  SizedReturnItem<S, DistributiveAmount<K>>;
//conversion happens in 3 stages:
// 1. raw value is read from layout
// 2. then it is optionally transformed (e.g. scaled/multiplied/etc.)
// 3. finally it is converted into an amount of the given kind and unit
//and likewise but inverted for the opposite direction
export function amountItem<S extends number, const K extends KindWithAtomic>(
  size: S,
  kind: K, //uses "atomic" by default
  unitSymbolOrTransform?: SymbolsOf<K> | TransformFuncUnion<S>,
): AmountReturnItem<S, K>;
export function amountItem<S extends number, const K extends Kind>(
  size: S,
  kind: K,
  unitSymbol: SymbolsOf<K>,
  transform?: TransformFuncUnion<S>,
): AmountReturnItem<S, K>;
export function amountItem<S extends number, const K extends Kind>(
  size: S,
  kind: K,
  unitSymbolOrTransform?: SymbolsOf<K> | TransformFuncUnion<S>,
  transform?: TransformFuncUnion<S>,
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
        numericReturn(size)(amount.toUnit(unitSymbol) as Rational),
    }
    : {
      to: (val: NumericType<S>) =>
        toFunc(transform.to(val)),
      from: (amount: DistributiveAmount<K>): NumericType<S> =>
        transform.from(amount.toUnit(unitSymbol) as Rational),
    };

  return { binary: "uint", size, custom };
}

type ConversionReturnItem<S extends number, NK extends Kind, DK extends Kind> =
  SizedReturnItem<S, Conversion<NK, DK>>;

type AmountItem = {
  binary: "uint";
  size: number;
  custom: CustomConversion<any, Amount<any>>;
};

//annoyingly, using AI extends AmountReturnItem<number, Kind> here breaks things for reasons
//  that are somewhat unclear to me (incompatible CustomConversion types), hence the AmountItem
//  workaround
export function conversionItem<const AI extends AmountItem, const DK extends KindWithHuman>(
  amntItem: AI,
  denKind: DK, //uses "human" unit by default
): AI extends AmountReturnItem<infer S, infer NK> ? ConversionReturnItem<S, NK, DK> : never;
export function conversionItem<const AI extends AmountItem, const DK extends Kind>(
  amntItem: AI,
  denKind: DK,
  //eslint-disable-next-line @typescript-eslint/unified-signatures
  denUnit: SymbolsOf<DK>,
): AI extends AmountReturnItem<infer S, infer NK> ? ConversionReturnItem<S, NK, DK> : never;
export function conversionItem<
  S extends number,
  const NK extends Kind,
  const DK extends KindWithHuman,
>(size: S,
  numKind: NK,
  numUnit: SymbolsOf<NK>,
  denKind: DK, //uses "human" unit by default
  transform?: TransformFuncUnion<S>,
): ConversionReturnItem<S, NK, DK>;
export function conversionItem<S extends number, const NK extends Kind, const DK extends Kind>(
  size: S,
  numKind: NK,
  numUnit: SymbolsOf<NK>,
  denKind: DK,
  denUnit: SymbolsOf<DK>,
  transform?: TransformFuncUnion<S>,
): ConversionReturnItem<S, NK, DK>;
export function conversionItem(
  amntItemOrSize: AmountItem | number,
  denKindOrNumKind: Kind,
  denUnitOrNumUnit?: string,
  denKind?: Kind,
  transformOrDenUnit?: TransformFuncUnion<number> | string,
  transform?: TransformFuncUnion<number>,
): any {
  if (typeof amntItemOrSize === "number") {
    const size = amntItemOrSize;
    const numKind = denKindOrNumKind;
    let numUnit = denUnitOrNumUnit!;
    denKind = denKind!;
    let denUnit;
    if (typeof transformOrDenUnit === "string")
      denUnit = transformOrDenUnit;
    else {
      denUnit = "human";
      transform = transformOrDenUnit;
    }

    if (typeof transform === "function")
      transform = transform(size);

    //atomic units are special because .toUnit() returns a bigint but we always want a Rational
    if (numUnit === "atomic")
      numUnit = numKind.atomic!;
    if (denUnit === "atomic")
      denUnit = denKind.atomic!;

    const denAmnt = Amount.from(1, denKind, denUnit);

    const toFunc = (val: Rationalish): Conversion<Kind, Kind> =>
      Conversion.from(Amount.from(val, numKind, numUnit), denAmnt);

    const fromFunc = (conv: Conversion<Kind, Kind>): Rational =>
      denAmnt.convert(conv).toUnit(numUnit);

    const custom = typeof transform === "object"
      ? {
        to: (val: NumericType<number>) =>
          toFunc(val),
        from: (conv: Conversion<Kind, Kind>): NumericType<number> =>
          numericReturn(size)(fromFunc(conv)),
      }
      : {
        to: (val: NumericType<number>) =>
          toFunc((transform as TransformFunc<number>).to(val)),
        from: (conv: Conversion<Kind, Kind>): NumericType<number> =>
          (transform as TransformFunc<number>).from(fromFunc(conv)),
      };

    return { binary: "uint", size, custom };
  }

  const amntItem = amntItemOrSize;
  denKind = denKindOrNumKind;
  let denUnit = denUnitOrNumUnit ?? "human";
  denUnit = denUnit === "atomic" ? denKind.atomic! : denUnit;
  const denAmnt = Amount.from(1, denKind, denUnit);
  const custom = {
    to: (val: NumericType<number>): Conversion<Kind, Kind> =>
      Conversion.from(amntItem.custom.to(val), denAmnt),
    from: (conv: Conversion<Kind, Kind>): NumericType<number> =>
      amntItem.custom.from(denAmnt.convert(conv)),
  };

  return { ...amntItem, custom };
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
  };
}
