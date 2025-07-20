// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  RoPair,
  Tuple,
  RoTuple,
  RoArray,
  HeadTail,
  Extends,
  IsAny,
} from "./metaprogramming.js";

export type RoTuple2D<T = unknown> = RoTuple<RoTuple<T>>;
export type RoArray2D<T = unknown> = RoArray<RoArray<T>>;

export type PreserveReadonly<A extends RoArray, R extends RoArray> =
  A extends Tuple | unknown[]
  ? R
  : Readonly<R>;

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
  IsAny<T> extends true //prevent DeepReadonly<any> from giving type instantiation too deep error
  ? any
  : T extends RoTuple
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
export type Entries<A extends RoArray> =
  A extends RoTuple
  ? TupleEntries<A>
  : A extends RoArray<infer U>
  ? [number, U][]
  : never;

export function entries<const T extends RoArray>(arr: T): Entries<T> {
  return [...arr.entries()] as Entries<T>;
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

export function valueIndexEntries<const T extends RoArray>(arr: T): ValueIndexEntries<T> {
  return arr.map((value, index) => [value, index]) as ValueIndexEntries<T>;
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

export type TupleChunkImpl<T extends RoTuple, N extends number, PC extends RoTuple = []> =
  PC["length"] extends N
  ? [T, PC]
  : T extends HeadTail<T, infer Head, infer Tail>
  ? TupleChunkImpl<Tail, N, [...PC, Head]>
  : [[], PC];

export type TupleChunk<T extends RoTuple, N extends number> =
  TupleChunkImpl<T, N> extends [infer R extends RoTuple, infer C]
  ? C extends readonly []
    ? []
    : [C, ...TupleChunk<R, N>]
  : never;

type ArrayChunk<A extends RoArray> = A extends RoArray<infer U> ? U[][] : never;

export type Chunk<A extends RoArray, N extends number> =
  A extends RoTuple
  ? number extends N
    ? ArrayChunk<A>
    : TupleChunk<A, N>
  : ArrayChunk<A>;

export const chunk = <const A extends RoArray, N extends number>(arr: A, size: N): Chunk<A, N> =>
  range(Math.ceil(arr.length / size)).map(i => arr.slice(i * size, (i+1) * size)) as Chunk<A, N>;

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
  : A extends infer T extends RoTuple
  ? [...{ [K in keyof T]: T[K] extends RoArray ? T[K][number] : never }][]
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

type FilterIndexesKeepImpl<T extends RoTuple, I extends IndexEs> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends RoPair<infer J extends number, infer V>
    ? J extends I
      ? [V, ...FilterIndexesKeepImpl<Tail, I>]
      : FilterIndexesKeepImpl<Tail, I>
    : never
  : [];

type FilterIndexesRemoveImpl<T extends RoTuple, I extends IndexEs> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends RoPair<infer J extends number, infer V>
    ? J extends I
      ? FilterIndexesRemoveImpl<Tail, I>
      : [V, ...FilterIndexesRemoveImpl<Tail, I>]
    : never
  : [];

export type FilterIndexes<A extends RoArray, I extends IndexEs, FilterOut extends boolean = false> =
  A extends infer T extends RoTuple
  ? FilterOut extends true
    ? FilterIndexesRemoveImpl<Entries<T>, I>
    : FilterIndexesKeepImpl<Entries<T>, I>
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

type MapToTuple<A extends RoArray, R> =
  [...{ [K in keyof A]: K extends `${number}` ? R : never }];
type MapToImpl<A extends RoArray, R> =
  PreserveReadonly<A, A extends RoTuple ? MapToTuple<A, R> : R[]>;
type MappingFunc<A extends RoArray, F> =
  MapToImpl<A, F extends (value: A[number]) => infer R ? R : never>;

export type MapTo<A extends RoArray> =
  <F extends (value: A[number]) => unknown>(f: F) =>
    MappingFunc<A, F>;
//normal tuple.map does not yield a tuple, but an array, i.e.
// const test = [1, 2, 3] as const;
// test.map(x => x * 2) // => number[]
// mapTo(test)(x => x * 2) // => readonly [number, number, number]
export const mapTo = <const A extends RoArray>(arr: A): MapTo<A> =>
  <F extends (value: A[number]) => unknown>(f: F): MappingFunc<A, F> =>
    //eslint-disable-next-line unicorn/no-array-callback-reference
    arr.map(f) as any;

export type TupleFilter<T extends RoTuple, Include> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends Include
    ? [Head, ...TupleFilter<Tail, Include>]
    : TupleFilter<Tail, Include>
  : [];

export type TupleFilterOut<T extends RoTuple, Exclude> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends Exclude
    ? TupleFilterOut<Tail, Exclude>
    : [Head, ...TupleFilterOut<Tail, Exclude>]
  : [];

export type Intersect<T extends RoArray, U extends RoArray> =
  [T, U] extends [infer TT extends RoTuple, infer UU extends RoTuple]
  ? TupleFilter<TT, UU[number]>
  : (T[number] & U[number])[];

export function intersect<
  const T extends RoTuple,
  const U extends RoTuple,
>(lhs: T, rhs: U): Intersect<T, U>;
export function intersect<
  const T extends RoArray,
  const U extends RoArray,
>(lhs: T, rhs: U): Intersect<T, U>;
export function intersect(lhs: RoArray, rhs: RoArray) {
  return lhs.filter(item => rhs.includes(item));
}

export type Union<T extends RoArray, U extends RoArray> =
  [T, U] extends [infer TT extends RoTuple, infer UU extends RoTuple]
  ? [...TT, ...TupleFilterOut<UU, TT[number]>]
  : (T[number] | U[number])[];

export function union<
  const T extends RoTuple,
  const U extends RoTuple,
>(lhs: T, rhs: U): Union<T, U>;
export function union<
  const T extends RoArray,
  const U extends RoArray,
>(lhs: T, rhs: U): Union<T, U>;
export function union(lhs: RoArray, rhs: RoArray) {
  return [...lhs, ...rhs.filter(item => !lhs.includes(item))];
}

export type Difference<T extends RoArray, U extends RoArray> =
  [T, U] extends [infer TT extends RoTuple, infer UU extends RoTuple]
  ? TupleFilterOut<TT, UU[number]>
  : Exclude<T[number], U[number]>[];

export function difference<
  const T extends RoTuple,
  const U extends RoTuple,
>(lhs: T, rhs: U): TupleFilterOut<T, U[number]>;
export function difference<
  const T extends RoArray,
  const U extends RoArray,
>(lhs: T, rhs: U): Difference<T, U>;
export function difference(lhs: RoArray, rhs: RoArray) {
  return lhs.filter(item => !rhs.includes(item));
}
