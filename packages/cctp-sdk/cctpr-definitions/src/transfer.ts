// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TODO } from "@stable-io/utils";
import { Amount } from "@stable-io/amount";
import type {
  Network,
  PlatformOf,
  PlatformAddress,
  GasTokenOf,
} from "@stable-io/cctp-sdk-definitions";
import { gasTokenKindOf, platformOf } from "@stable-io/cctp-sdk-definitions";
import type { SupportedDomain } from "./constants.js";
import { gasDropoffLimitOf } from "./constants.js";
import type {
  RegisteredCctprPlatform,
  LoadedCctprPlatformDomain,
  CctprRecipientAddress,
} from "./registry.js";
import { platformCctpr } from "./registry.js";
import type { InOrOut, QuoteBase, CorridorParamsBase } from "./common.js";

export const transfer = <
  N extends Network,
  P extends RegisteredCctprPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  sender: PlatformAddress<P>,
  recipient: CctprRecipientAddress<N, D>,
  inOrOut: InOrOut,
  corridor: CorridorParamsBase<N, PlatformOf<S>, S, D>,
  quote: QuoteBase<N, PlatformOf<S>, S>,
  gasDropoff: GasTokenOf<D>,
  options: TODO,
): AsyncGenerator<TODO, TODO> => {
  const platform = platformOf(source);
  const gasDropoffLimit = Amount.ofKind(gasTokenKindOf(destination))(
    gasDropoffLimitOf[network][destination],
  );
  if (gasDropoff.gt(gasDropoffLimit as TODO)) {
    throw new Error("Gas Drop Off Limit Exceeded");
  }

  const cctprImpl = platformCctpr(platform);
  return cctprImpl.transfer(
    network,
    source,
    destination,
    sender,
    recipient,
    inOrOut,
    corridor,
    quote,
    gasDropoff,
    options,
  );
};
