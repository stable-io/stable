// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* istanbul ignore file */
import "@stable-io/cctp-sdk-cctpr-evm";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { viemChainOf } from "@stable-io/cctp-sdk-viem";
import { Url } from "@stable-io/utils";

import { $checkHasEnoughFunds } from "./methods/checkHasEnoughFunds.js";
import { $executeRoute } from "./methods/executeRoute.js";
import { $findRoutes } from "./methods/findRoutes.js";
import { $findRedeem } from "./methods/findRedeem.js";
import { $getBalance } from "./methods/getBalance.js";
import { SDK, SDKOptions } from "./types/sdk.js";
import { Network } from "./types/general.js";

export class StableSDK<N extends Network> extends SDK<N> {
  public getNetwork(): N {
    return this.options.network;
  }

  public setSigner(signer: SDKOptions<N>["signer"]): void {
    this.options = { ...this.options, signer };
  }

  /**
   * @returns The viem wallet client of the user
   */
  public getSigner(domain: keyof EvmDomains): ReturnType<SDK<N>["getSigner"]> {
    const viemChain = viemChainOf[this.options.network][domain];
    const rpcUrl = this.getRpcUrl(domain);
    return this.options.signer.getWalletClient(viemChain, rpcUrl);
  }

  /**
   * @returns The rpc url being used for the domain
   */
  public getRpcUrl(domain: keyof EvmDomains): Url {
    const viemChain = viemChainOf[this.options.network][domain];
    return (this.options.rpcUrls?.[domain] ?? viemChain.rpcUrls.default.http[0]) as Url;
  }

  public findRoutes = $findRoutes({
    getNetwork: this.getNetwork.bind(this),
    getRpcUrl: this.getRpcUrl.bind(this),
  });

  public executeRoute = $executeRoute({
    getSigner: this.getSigner.bind(this),
    getNetwork: this.getNetwork.bind(this),
    getRpcUrl: this.getRpcUrl.bind(this),
  });

  public checkHasEnoughFunds = $checkHasEnoughFunds({
    getNetwork: this.getNetwork.bind(this),
    getRpcUrl: this.getRpcUrl.bind(this),
  });

  public getBalance = $getBalance({
    getNetwork: this.getNetwork.bind(this),
    getRpcUrl: this.getRpcUrl.bind(this),
  });

  public findRedeem = $findRedeem({
    getNetwork: this.getNetwork.bind(this),
    getRpcUrl: this.getRpcUrl.bind(this),
  });
}
