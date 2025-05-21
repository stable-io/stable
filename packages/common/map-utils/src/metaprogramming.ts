// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export type Extends<T, U> = T extends U ? true : false;
export type StrictExtends<T, U> = [T] extends [U] ? true : false;

export type NeTuple<T = unknown> = [T, ...T[]];
export type Tuple<T = unknown> = NeTuple<T> | [];
export type RoTuple<T = unknown> = Readonly<Tuple<T>>;
export type RoNeTuple<T = unknown> = Readonly<NeTuple<T>>;
export type RoArray<T = unknown> = readonly T[];
export type RoPair<T = unknown, U = unknown> = readonly [T, U];
//Function is is a generic overload of the built-in type
//  It should work as a more powerful drop-in replacement.
//  Since the built-in type is not generic and permissive, we have to use RoArray<any> as the
//    default type of the parameters, otherwise `Test` would become false after our overload:
// type TestFunc = (...args: [string, number]) => boolean;
// type Test = TestFunc extends Function ? true : false; //true for built-in
export type Function<P extends RoArray<unknown> = RoArray<any>, R = unknown> =
  (...args: P) => R;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type Simplify<T> = { [K in keyof T]: T[K] } & unknown;

//utility type to reduce boilerplate of iteration code by replacing:
// `T extends readonly [infer Head extends T[number], ...infer Tail extends RoTuple<T[number]>]`
//with just:
// `T extends HeadTail<T, infer Head, infer Tail>`
//this also avoids the somewhat common mistake of accidentally dropping the readonly modifier
export type HeadTail<T extends RoTuple, Head extends T[number], Tail extends RoTuple<T[number]>> =
  readonly [Head, ...Tail];

export type Widen<T> =
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T extends bigint ? bigint :
  T extends object ? object :
  T;

export type DefinedOrDefault<T, D> = undefined extends T ? D : NonNullable<T>;

//see here: https://stackoverflow.com/a/55541672
export type IsAny<T> = Extends<0, 1 & T>;

export type IsNever<T> = StrictExtends<T, never>;

export type Not<B extends boolean> = B extends true ? false : true;

//empty And is true (neutral element)
export type And<T extends RoTuple<boolean> | boolean, R extends boolean = true> =
  R extends true
  ? T extends RoTuple<boolean>
    ? false extends T[number]
      ? false
      : true
    : T
  : false;

//empty And is false (neutral element)
export type Or<T extends RoTuple<boolean> | boolean, R extends boolean = false> =
  R extends false
  ? T extends RoTuple<boolean>
    ? true extends T[number]
      ? true
      : false
    : T
  : true;

type XorImpl<T extends RoTuple<boolean>> =
  T extends readonly [infer First, infer Second, ...infer Tail extends RoArray<boolean>]
  ? XorImpl<[boolean extends First | Second ? true : false, ...Tail]>
  : T extends readonly [infer Final]
  ? Final
  : never; //Xor has no neutral element that we can return for the empty case

//empty Xor is not supported (xor has no neutral element)
export type Xor<T extends RoTuple<boolean> | boolean, R extends boolean | undefined = undefined> =
  T extends RoTuple<boolean>
  ? [
    ...T,
    ...(undefined extends R ? [] : [Exclude<R, undefined>]),
  ] extends infer V extends RoTuple<boolean>
    ? XorImpl<V>
    : never
  : boolean extends Exclude<R, undefined> | T ? true : false;

export type ParseNumber<T> = T extends `${infer N extends number}` ? N : never;

export type ConcatStringLiterals<A extends RoTuple<string>> =
  A extends HeadTail<A, infer S, infer Tail>
  ? `${S}${ConcatStringLiterals<Tail>}`
  : "";

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
