// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Rationalish, Rational } from "./rational.js";

export interface UnitBase {
  symbol: string;
  stringify?: (value: Rational) => string; //default is `${value / scale} ${symbol}`
};

export interface StandardUnit extends UnitBase {
  scale: 1 | 1n;
}

export interface Unit extends UnitBase {
  scale: Rationalish;
};

//A few examples regarding kinds, units, and meta-units:
//human and atomic units are abstractions across domains and can be thought of as meta-units:
// * human:  BTC, ETH, SOL, ...
// * atomic: Satoshi, Wei, or Lamport
//
//The idea of "atomic" being that in the real world, there's no mechanism to deal with units
//  smaller than that.
//
//Edge cases:
// * USD (Base unit: $):
//     The human unit is clearly "$", but the atomic unit is already somewhat murkier, though
//     arguably still cents (though sub-cent settlements can pop up in e.g. micro payments).
// * Information (Base unit: bit):
//     No atomic unit, but the human unit is clearly "bit".
//     (While e.g. Trits and Nats are also semi-common)
// * Computer storage (Base unit: byte):
//     No human unit, but the atomic unit is clearly "byte".
// * Time (Base unit: s):
//     No human unit, because it's mostly context dependent - from nanoseconds to years.
//     And likewise, not really an atomic unit either (except perhaps Planck seconds).

type KindUnits = readonly [StandardUnit, ...Unit[]];
type UnitSymbolsOf<U extends KindUnits> = U[number]["symbol"];

export type Kind<U extends KindUnits = KindUnits> = {
  name:       string;
  units:      U;
  human?:     UnitSymbolsOf<U>;
  atomic?:    UnitSymbolsOf<U>;
  //TODO: formatting: opts?: { unit?: SymbolsOf<Id>; precision?: number }
  stringify?: (standardValue: Rational) => string; //default is `${standardValue} ${standardSymbol}`
};

type RequiredProperties<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type KindWithHuman<U extends KindUnits = KindUnits> = RequiredProperties<Kind<U>, "human">;
export type KindWithAtomic<U extends KindUnits = KindUnits> = RequiredProperties<Kind<U>, "atomic">;

export type SymbolsOf<K extends Kind> =
  K["units"][number]["symbol"] | Extract<keyof K, "human" | "atomic">;
