// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { RoPair, RoTuple, RoArray, HeadTail, Extends, Not } from "./metaprogramming.js";

export type RoTuple2D<T = unknown> = RoTuple<RoTuple<T>>;
export type RoArray2D<T = unknown> = RoArray<RoArray<T>>;

type TupleRangeImpl<L extends number, A extends number[] = []> =
  A["length"] extends L
  ? A
  : TupleRangeImpl<L, [...A, A["length"]]>;

export type TupleRange<L extends number> =
  number extends L
  ? never
  : L extends unknown
  ? TupleRangeImpl<L>
  : never;

export type Range<L extends number> =
  L extends unknown
  ? number extends L
    ? number[]
    : TupleRange<L>
  : never;

export type TupleWithLength<T, L extends number> =
  TupleRange<L> extends infer R extends RoArray<number>
  ? [...{ [K in keyof R]: T }]
  : never;

export type RoTupleWithLength<T, L extends number> = Readonly<TupleWithLength<T, L>>;

export const range = <const L extends number>(length: L) =>
  [...Array.from({ length }).keys()] as Range<L>;

//capitalization to highlight that this is intended to be a literal or a union of literals
export type IndexEs = number;

export type DeepReadonly<T> =
  T extends RoTuple
  ? T extends HeadTail<T, infer Head, infer Tail>
    ? readonly [DeepReadonly<Head>, ...DeepReadonly<Tail>]
    : readonly []
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export const deepReadonly = <const T>(value: T): DeepReadonly<T> => value as DeepReadonly<T>;

export type TupleEntries<T extends RoTuple> =
  [...{ [K in keyof T]: K extends `${infer N extends number}` ? [N, T[K]] : never }];

//const aware version of Array.entries
export type Entries<T extends RoArray> =
  T extends RoTuple
  ? TupleEntries<T>
  : T extends RoArray<infer U>
  ? [number, U][]
  : never;

export function entries<const T extends RoTuple>(arr: T): TupleEntries<T>;
export function entries<const T extends RoArray>(arr: T): Entries<T>;
export function entries(arr: readonly unknown[]): [number, unknown][] {
  return [...arr.entries()];
}

export type ValueIndexTupleEntries<T extends RoTuple> =
  [...{ [K in keyof T]: K extends `${infer N extends number}` ? [T[K], N] : never }];

//const aware version of Array.entries but with value first, index second
export type ValueIndexEntries<T extends RoArray> =
  T extends RoTuple
  ? ValueIndexTupleEntries<T>
  : T extends RoArray<infer U>
  ? [U, number][]
  : never;

export function valueIndexEntries<const T extends RoTuple>(arr: T): ValueIndexTupleEntries<T>;
export function valueIndexEntries<const T extends RoArray>(arr: T): ValueIndexEntries<T>;
export function valueIndexEntries(arr: readonly unknown[]): [unknown, number][] {
  return arr.map((value, index) => [value, index]);
}

export type IsArray<T> = T extends RoArray<unknown> ? true : false;
export type IsFlat<A extends RoArray> = true extends IsArray<A[number]> ? false : true;

export type TupleFlatten<T extends RoTuple> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends RoTuple
    ? [...Head, ...TupleFlatten<Tail>]
    : [Head, ...TupleFlatten<Tail>]
  : [];

type StripArray<T> = T extends RoArray<infer E> ? E : T;

export type Flatten<A extends RoArray> =
  A extends RoTuple
  ? TupleFlatten<A>
  : StripArray<A[number]>[];

export const flatten = <const A extends RoArray>(arr: A) =>
  arr.flat() as Flatten<A>;

export type InnerFlatten<A extends RoArray> =
  [...{ [K in keyof A]:
    K extends `${number}`
    ? A[K] extends RoArray
      ? Flatten<A[K]>
      : A[K]
    : never
  }];

export type Unflatten<A extends RoArray> =
  [...{ [K in keyof A]: K extends `${number}` ? [A[K]] : never }];

export type IsRectangular<T extends RoTuple> =
  T extends RoTuple2D
  ? T extends HeadTail<T, infer Head extends RoTuple, infer Tail extends RoTuple2D>
    ? Tail extends readonly []
      ? true //a column is rectangular
      : Tail[number]["length"] extends Head["length"] ? true : false
    : true //empty is rectangular
  : true; //a row is rectangular

export type Column<A extends RoArray2D, I extends number> =
  [...{ [K in keyof A]: K extends `${number}` ? A[K][I] : never }];

export const column = <const A extends RoArray2D, const I extends number>(tupArr: A, index: I) =>
  tupArr.map(tuple => tuple[index]) as Column<A, I>;

export type TupleZip<T extends RoTuple2D> =
  IsRectangular<T> extends true
  ? T[0] extends infer Head extends RoTuple
    ? [...{ [K in keyof Head]:
        K extends `${number}`
        ? [...{ [K2 in keyof T]: K extends keyof T[K2] ? T[K2][K] : never }]
        : never
      }]
    : []
  : never;

export type Zip<A extends RoArray2D> =
  A extends RoTuple2D
  ? TupleZip<A>
  : Flatten<A>[number][][];

export const zip = <const Args extends RoArray2D>(arr: Args) =>
  range(arr[0]!.length).map(col =>
    range(arr.length).map(row => arr[row]![col]),
  ) as Zip<Args>;

//extracts elements with the given indexes in the specified order, explicitly forbid unions
export type TuplePickWithOrder<A extends RoArray, I extends RoTuple<number>> =
  I extends HeadTail<I, infer Head, infer Tail>
  ? A[Head] extends undefined
    ? TuplePickWithOrder<A, Tail>
    : [A[Head], ...TuplePickWithOrder<A, Tail>]
  : [];

export type PickWithOrder<A extends RoArray, I extends RoArray<number>> =
  [A, I] extends [infer T extends RoTuple, infer TI extends RoTuple<number>]
  ? TuplePickWithOrder<T, TI>
  : A;

export const pickWithOrder =
  <const A extends RoArray, const I extends RoArray<number>>(arr: A, indexes: I) =>
    indexes.map(i => arr[i]) as PickWithOrder<A, I>;

type FilterIndexesImpl<T extends RoTuple, I extends IndexEs, FilterIn extends boolean> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends RoPair<infer J extends number, infer V>
    ? Extends<J, I> extends FilterIn
      ? [V, ...FilterIndexesImpl<Tail, I, FilterIn>]
      : FilterIndexesImpl<Tail, I, FilterIn>
    : never
  : [];

export type FilterIndexes<A extends RoArray, I extends IndexEs, FilterOut extends boolean = false> =
  A extends infer T extends RoTuple
  ? FilterIndexesImpl<Entries<T>, I, Not<FilterOut>>
  : A;

export const filterIndexes = <
  const T extends RoArray,
  const I extends RoArray<number>,
  const E extends boolean = false,
>(arr: T, indexes: I, exclude?: E) => {
  const indexSet = new Set(Array.isArray(indexes) ? indexes : [indexes]);
  return arr.filter((_, i) => indexSet.has(i) !== exclude) as FilterIndexes<T, I[number], E>;
};

export type Cartesian<L, R> =
  L extends RoArray
  ? Flatten<[...{ [K in keyof L]: K extends `${number}` ? Cartesian<L[K], R> : never }]>
  : R extends RoArray
  ? [...{ [K in keyof R]: K extends `${number}` ? [L, R[K]] : never }]
  : [L, R];

export function sortInPlace<const T extends number[] | bigint[]>(
  arr: T,
  ascending: boolean = true,
): T {
  const [g, l] = ascending ? [1, -1] : [-1, 1];
  return arr.sort((a: number | bigint, b: number | bigint) => a > b ? g : a < b ? l : 0) as T;
}

export function median<const T extends number[] | bigint[]>(
  arr: T,
  isSorted: boolean = false,
): T[number] {
  if (arr.length === 0)
    throw new Error("Can't calculate median of empty array");

  //TODO inefficient, should be implemented using https://en.wikipedia.org/wiki/Median_of_medians
  const sorted = isSorted ? arr : sortInPlace([...arr]);

  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1)
    return sorted[mid]!;

  const lower = sorted[mid - 1]!;
  const upper = sorted[mid]!;
  return (typeof lower === "number")
    ? (lower + (upper as typeof lower)) / 2
    : (lower + (upper as typeof lower)) / 2n;
}
