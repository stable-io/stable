// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Rationalish, Rational } from "./rational.js";
import type { Kind, KindWithHuman, Unit, SymbolsOf } from "./types.js";
import type { Conversion } from "./conversion.js";

export class Amount<K extends Kind> {
  private constructor(
    private readonly amount: Rational, //class invariant: stored in standard units
    readonly kind: K,
  ) {}

  static ofKind<const K extends KindWithHuman>(kind: K):
    (amount: Rationalish | string, unitSymbol?: SymbolsOf<K>) => Amount<K>;
  static ofKind<const K extends Kind>(kind: K):
    (amount: Rationalish | string, unitSymbol: SymbolsOf<K>) => Amount<K>;
  static ofKind(kind: Kind) {
    return (amount: Rationalish | string, unitSymbol?: string) =>

      (Amount.from as any)(amount, kind, unitSymbol ?? kind.human);
  }

  static from<const K extends KindWithHuman>(
    amount: Rationalish | string,
    kind: K,
    unitSymbol?: SymbolsOf<K>,
  ): Amount<K>;
  static from<const K extends Kind>(
    amount: Rationalish | string,
    kind: K,
    unitSymbol: SymbolsOf<K>,
  ): Amount<K>;
  static from<const K extends Kind>(
    amount: Rationalish | string,
    kind: K,
    unitSymbol?: SymbolsOf<K>,
  ): Amount<K> {
    const unit = Amount.getUnit(kind, unitSymbol);
    amount = Rational.from(amount).mul(unit.scale);
    return new Amount(amount, kind);
  }

  toString(): string {
    const stringify = this.kind.stringify;
    if (stringify !== undefined)
      return stringify(this.amount);

    const symbol = this.kind.human ?? this.kind.units[0].symbol;
    return this.toUnit(symbol).toString() + " " + symbol;
  }

  toJSON(): string {
    return this.toString();
  }

  toUnit<S extends SymbolsOf<K>>(unitSymbol: S): S extends "atomic" ? bigint : Rational;
  //The two following overloads seem unnecessary since they are already covered by the first one.
  //  However, when dealing with a union type of amounts of different kinds and trying to call e.g.
  //  toUnit("human") on it, without the extra overloads, tsc will complain because the different
  //  kinds provide different signatures for the toUnit call and tsc is not smart enough to realize
  //  that "human" is a valid parameter for all of them but will complain that the signatures are
  //  all different. Hence explicitly providing these overloads lets tsc recognize that the call
  //  is valid if indeed all kinds of the union provide the corresponding meta-unit.
  toUnit(unitSymbol: K extends { human: string } ? "human" : never): Rational;
  toUnit(unitSymbol: K extends { atomic: string } ? "atomic" : never): bigint;
  toUnit<S extends SymbolsOf<K>>(unitSymbol: S): S extends "atomic" ? bigint : Rational {
    const rat = this.getIn(unitSymbol);
    return (unitSymbol === "atomic" ? rat.floor() : rat) as S extends "atomic" ? bigint : Rational;
  }

  ceilTo<S extends SymbolsOf<K>>(unitSymbol: S): Amount<K> {
    return Amount.from(this.getIn(unitSymbol).ceil(), this.kind, unitSymbol);
  }

  floorTo<S extends SymbolsOf<K>>(unitSymbol: S): Amount<K> {
    return Amount.from(this.getIn(unitSymbol).floor(), this.kind, unitSymbol);
  }

  eq(other: Amount<K>): boolean {
    this.checkKind(other);
    return this.amount.eq(other.amount);
  }

  ne(other: Amount<K>): boolean {
    this.checkKind(other);
    return this.amount.ne(other.amount);
  }

  lt(other: Amount<K>): boolean {
    this.checkKind(other);
    return this.amount.lt(other.amount);
  }

  le(other: Amount<K>): boolean {
    this.checkKind(other);
    return this.amount.le(other.amount);
  }

  gt(other: Amount<K>): boolean {
    this.checkKind(other);
    return this.amount.gt(other.amount);
  }

  ge(other: Amount<K>): boolean {
    this.checkKind(other);
    return this.amount.ge(other.amount);
  }

  add(other: Amount<K>): Amount<K> {
    this.checkKind(other);
    return new Amount(this.amount.add(other.amount), other.kind);
  }

  sub(other: Amount<K>): Amount<K> {
    this.checkKind(other);
    return new Amount(this.amount.sub(other.amount), other.kind);
  }

  mul(other: number | bigint | Rational): Amount<K> {
    return new Amount(this.amount.mul(other), this.kind);
  }

  div(other: number | bigint | Rational): Amount<K> {
    return new Amount(this.amount.div(other), this.kind);
  }

  convert<
    NK extends Kind,
    DK extends K,
  >(conv: Conversion<NK, DK>): Amount<NK> {
    this.checkKind(conv.den);
    return new Amount(this.amount.mul(conv.ratio), conv.num);
  }

  standardUnit(): Unit {
    return this.kind.units[0];
  }

  static getUnit<K extends Kind>(kind: K, unitSymbol?: SymbolsOf<K>): Unit {
    const symbol = unitSymbol === undefined || unitSymbol === "human"
      ? kind.human
      : unitSymbol === "atomic"
      ? kind.atomic
      : unitSymbol;
    // istanbul ignore if
    if (symbol === undefined)
      throw new Error(`Unit ${unitSymbol} not found in kind ${kind.name}`);
    return kind.units.find(u => u.symbol === symbol)!;
  }

  private getIn<S extends SymbolsOf<K>>(unitSymbol: S): Rational {
    return this.amount.div(Amount.getUnit(this.kind, unitSymbol).scale);
  }

  private checkKind(other: Kind | Amount<Kind>): void {
    const otherKind = "kind" in other ? other.kind.name : other.name;
    if (this.kind.name !== otherKind)
      throw new Error(`Kind mismatch: ${this.kind.name} vs ${otherKind}`);
  }
}
