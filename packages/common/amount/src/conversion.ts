// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Rationalish, Rational } from "./rational.js";
import type { Kind, KindWithHuman, Unit } from "./types.js";
import { Amount } from "./amount.js";

export class Conversion<NK extends Kind, DK extends Kind> {
  private constructor(
    readonly ratio: Rational,
    readonly num: NK,
    readonly den: DK,
  ) {}

  static from<NK extends Kind, DK extends Kind>(
    ratio: Rationalish,
    num: KindWithHuman & NK,
    den: KindWithHuman & DK,
  ): Conversion<NK, DK>;
  static from<NK extends Kind, DK extends Kind>(
    num: Amount<NK>,
    den: KindWithHuman & DK | Amount<DK>,
  ): Conversion<NK, DK>;
  static from(
    ratioOrNum: Rationalish | Amount<Kind>,
    numOrDen: KindWithHuman | Amount<Kind>,
    maybeDen?: KindWithHuman,
  ): any {
    const isAmount = (x: any): x is Amount<Kind> => typeof x === "object" && "kind" in x;
    const [amtNum, den] = isAmount(ratioOrNum)
      ? [ratioOrNum, numOrDen]
      : [Amount.from(ratioOrNum, numOrDen as KindWithHuman, "human"), maybeDen];

    const amtDen = isAmount(den) ? den : Amount.from(1, den as KindWithHuman, "human");

    return Conversion.checkedNew(
      amtNum.toUnit(amtNum.standardUnit().symbol).div(amtDen.toUnit(amtDen.standardUnit().symbol)),
      amtNum.kind,
      amtDen.kind,
    );
  }

  toString(): string {
    const getUnit = (kind: Kind): Unit => Amount.getUnit(kind, kind.human ?? kind.units[0].symbol);
    const numUnit = getUnit(this.num);
    const denUnit = getUnit(this.den);
    const scaledRatio = this.ratio.mul(denUnit.scale).div(numUnit.scale);
    const rat = this.num.stringify?.(scaledRatio) ?? scaledRatio.toString();
    return `${rat} ${numUnit.symbol}/${denUnit.symbol}`;
  }

  mul(scalar: Rationalish): Conversion<NK, DK> {
    return new Conversion(this.ratio.mul(scalar), this.num, this.den);
  }

  div(scalar: Rationalish): Conversion<NK, DK> {
    return new Conversion(this.ratio.div(scalar), this.num, this.den);
  }

  inv(): Conversion<DK, NK> {
    return new Conversion(this.ratio.inv(), this.den, this.num);
  }

  combine<
    NKO extends DK,
    DKO extends Kind,
  >(other: Conversion<NKO, DKO>): Conversion<NK, DKO> {
    if (this.den.name !== other.num.name)
      throw new Error(`Kind mismatch: ${this.den.name} vs ${other.num.name}`);

    return Conversion.checkedNew(this.ratio.mul(other.ratio), this.num, other.den);
  }

  private static checkedNew<
    NK extends Kind,
    DK extends Kind,
  >(ratio: Rational, num: NK, den: DK): Conversion<NK, DK> {
    if (num.name === den.name)
      throw new Error(`Must be distinct kinds: ${num.name} vs ${den.name}`);

    return new Conversion(ratio, num, den);
  }
}
