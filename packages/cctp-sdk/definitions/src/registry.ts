// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ApplyAliases, BaseObject } from "@stable-io/utils";
import type { Platform, DomainsOf, PlatformOf } from "./constants/index.js";

export interface ConfigRegistry extends BaseObject {
  //SelectedNetwork: <Network>
  //UseUnionAliases: <boolean>
}

export interface ProtocolRegistry extends BaseObject {
  //[Protocol name]: {
  //  PlatformImpls: <Platform>
  //  [Platform name]: {protocol specific}
  //}
}
export interface PlatformRegistry extends BaseObject {
  //included platform packages register as:
  //[Platform name]: {
  //  Client: ClientType;
  //  Address: AddressType;
  //  UnsignedTx: UnsignedTxType;
  //  UnsignedMsg: UnsignedMsgType;
  //};
}

export type Protocol = keyof ProtocolRegistry;
export type PlatformSpecificsOf<R extends Protocol, P extends Platform> =
  R extends keyof ProtocolRegistry
  ? P extends keyof ProtocolRegistry[R]
    ? ProtocolRegistry[R][P]
    : never
  : never;

export type PlatformTypesOf<P extends Platform> =
  P extends keyof RegisteredPlatform
  ? RegisteredPlatform[P]
  : never;

export type RegisteredPlatform = keyof PlatformRegistry;
export type LoadedDomain = DomainsOf<RegisteredPlatform>;
export type ToPlatform<T extends LoadedDomain | RegisteredPlatform> =
  T extends LoadedDomain ? PlatformOf<T> : T;

export type PlatformImplsOf<R extends Protocol> =
  keyof ProtocolRegistry[R]["PlatformImplsOf"];

export type Aliased<IofA extends object, Union> =
  [ConfigRegistry["UseUnionAliases"]] extends [true]
  ? ApplyAliases<IofA, Union>
  : Union;

//TODO TODO TODO TODO standin, move everything below to separate package
export interface DomainAliases extends BaseObject {}
