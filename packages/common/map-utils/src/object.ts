// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { RoNeTuple, RoTuple, RoPair, HeadTail, Simplify } from "./metaprogramming.js";

//TODO implement support for arrays (that aren't tuples)
//  Right now, the typing prevents passing arrays to functions whose values are not known at
//    compile time, limiting their use to compile time constructs thought they ought to also be
//    usable for runtime values.
//  So while existing types should remain as is and enforce tuple types, function signatures should
//    be more permissive and allow for the correct RoArray types with return types of course
//    becoming more general.
//TODO also decide on whether Tuples should be enforced to be non-empty or not

export type PlainObject = Record<PropertyKey, unknown>;

type Keys<O extends PlainObject> = RoTuple<keyof O>;
type KeyOrKeys<O extends PlainObject> = keyof O | Keys<O>;
type ToKeyUnion<O extends PlainObject, K extends KeyOrKeys<O>> =
  K extends Keys<O>
  ? K[number]
  : K extends keyof O
  ? K
  : never;

// ---- Pick ----

export function pick<const O extends PlainObject, const K extends KeyOrKeys<O>>(
  obj: O,
  keyOrKeys: K,
): Pick<O, ToKeyUnion<O, K>> {
  if (Array.isArray(keyOrKeys)) {
    const keys = keyOrKeys as Keys<O>;
    return Object.fromEntries(keys.map(key => [key, obj[key]])) as any;
  }

  const key = keyOrKeys as keyof O;
  return { [key]: obj[key] } as any;
}

// ---- Omit ----

export function omit<const O extends PlainObject, const K extends KeyOrKeys<O>>(
  obj: O,
  keyOrKeys: K,
): Omit<O, ToKeyUnion<O, K>> {
  if (Array.isArray(keyOrKeys)) {
    const keys = keyOrKeys as Keys<O>;
    const ret = { ...obj } as any;
    for (const key of keys)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete ret[key];

    return ret;
  }

  const key = keyOrKeys as keyof O;
  const { [key]: _, ...ret } = obj as any;
  return ret;
}

// ---- Replace ----

export type Replace<O extends PlainObject, K extends keyof O, V> =
  { [OK in keyof O]: K extends OK ? V : O[OK] };

export function replace<const O extends PlainObject, K extends keyof O, V>(
  obj: O,
  key: K,
  newValue: V,
): Replace<O, K, V> {
  return { ...obj, [key]: newValue } as Replace<O, K, V>;
}

// ---- Spread ----

//Spread<{ a: 1; n: { b: 2; c: 3 } }, "n"> = { a: 1; b: 2; c: 3 }
export type Spread<O extends PlainObject, K extends keyof O> =
  Simplify<Omit<O, K> & { [SK in keyof O[K]]: O[K][SK] }>;

export function spread<const O extends PlainObject, K extends keyof O>(
  obj: O,
  key: K,
): Spread<O, K> {
  const { [key]: nestedObj, ...rest } = obj;
  return { ...rest, ...nestedObj as object } as Spread<O, K>;
}

// ---- Nest ----

//Nest<{ a: 1; b: 2; c: 3 }, "n", "b" | "c">; = { a: 1; n: { b: 2; c: 3 } }
export type Nest<O extends PlainObject, NK extends PropertyKey, K extends keyof O> =
  Simplify<Omit<O, K> & { [_ in NK]: { [SK in K]: O[SK] } }>;

export function nest<const O extends PlainObject, NK extends PropertyKey, K extends KeyOrKeys<O>>(
  obj: O,
  newKey: NK,
  toNest: K,
): Nest<O, NK, ToKeyUnion<O, K>> {
  return { ...omit(obj, toNest), [newKey]: pick(obj, toNest) } as any;
}

// ---- DeepOmit ----

export const anyKey = Symbol("anyKey");

type LastPathElement = PropertyKey | RoNeTuple<PropertyKey>;
type Path = readonly [...RoTuple<PropertyKey>, LastPathElement];
type Paths = Path | RoTuple<Path>;

type CoalescePath<P extends Path> =
  P extends readonly [infer Start extends RoTuple<PropertyKey>, infer Last extends LastPathElement]
  ? [...Start, Last extends RoNeTuple<PropertyKey> ? Last[number] : Last]
  : P;

type ToAnyForAnyKey<H> = H extends typeof anyKey ? any : H;

type DeepOmitImpl<O, Path extends RoNeTuple<PropertyKey>> =
  Path extends HeadTail<Path, infer H, infer T>
  ? ToAnyForAnyKey<H> extends infer HA
    ? T extends RoNeTuple<PropertyKey>
      ? { [K in keyof O]: K extends HA ? DeepOmitImpl<O[K], T> : O[K] }
      : { [K in keyof O as K extends HA ? never : K]: O[K] }
    : never
  : never;

export type DeepOmit<O extends PlainObject, P extends Paths> =
  P extends HeadTail<P, infer H extends Path, infer T extends RoTuple<Path>>
  ? DeepOmit<DeepOmit<O, H>, T>
  : P extends Path
  ? CoalescePath<P> extends infer SP extends RoNeTuple<PropertyKey>
    ? DeepOmitImpl<O, SP>
    : O
  : O;

function deepOmitPath(obj: any, path: Path): any {
  const ret = { ...obj };
  let cur = ret;
  for (let i = 0; i < path.length - 1; ++i) {
    const key = path[i] as PropertyKey;
    if (key === anyKey) {
      const tail = path.slice(i + 1) as any;
      cur = Object.keys(cur).reduce<any>(
        (acc, k) => {
          acc[k] = deepOmitPath(cur[k], tail);
          return acc;
        },
        {},
      );
    }
    else if (key in cur && typeof cur[key] === "object" && cur[key] !== null) {
      cur[key] = { ...cur[key] };
      cur = cur[key];
    }
    else
      return ret;
  }
  const lastKey = path.at(-1);
  if (Array.isArray(lastKey))
    for (const key of lastKey)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete cur[key];
  else
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete cur[lastKey as PropertyKey];

  return ret;
}

export function deepOmit<const O extends PlainObject, const P extends Paths>(
  obj: O,
  pathOrPaths: P,
): DeepOmit<O, P> {
  if (pathOrPaths.length === 0)
    return obj as any;

  if (Array.isArray(pathOrPaths[0]))
    return pathOrPaths.reduce<any>((acc, path) => deepOmitPath(acc, path as any), obj);

  return deepOmitPath(obj, pathOrPaths as any);
}

// ---- DeepReplace ----

//TODO refine type to allow multiple replacements
export type DeepReplace<O, Path extends RoTuple<PropertyKey>, NewType>
  = Path extends HeadTail<Path, infer Head, infer Tail>
  ? { [K in keyof O]: K extends Head ? DeepReplace<O[K], Tail, NewType> : O[K] }
  : NewType;

//TODO implement deepReplace

// ---- FromEntries ----

export type FromEntries<T extends RoTuple<RoPair<PropertyKey, unknown>>> =
  Simplify<{ [E in T[number] as E extends RoPair<infer K, unknown> ? K : never]: 
      E extends RoPair<unknown, infer V> ? V : never;
  }>;

export function fromEntries<const T extends RoTuple<RoPair<PropertyKey, unknown>>>(
  entries: T,
): FromEntries<T> {
  return Object.fromEntries(entries) as any;
}
