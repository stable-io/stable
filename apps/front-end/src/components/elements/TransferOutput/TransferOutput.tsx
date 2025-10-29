// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

import { GasSettings } from "./GasSettings";

import { NetworkSettings } from "@/components";
import type { AvailableChains, GasDropoffLevel } from "@/constants";

interface TransferOutputProps {
  targetChain: AvailableChains;
  onSelectTargetChain: (chain: AvailableChains) => void;
  availableChains: readonly AvailableChains[];
  walletAddress?: string;
  gasDropoffLevel: GasDropoffLevel;
  onGasDropoffLevelSelect: (level: GasDropoffLevel) => void;
}

export const TransferOutput = ({
  targetChain,
  onSelectTargetChain,
  availableChains,
  walletAddress,
  gasDropoffLevel,
  onGasDropoffLevelSelect,
}: TransferOutputProps): ReactElement => {
  return (
    <div className="select-section select-to-section">
      <NetworkSettings
        title="To"
        selectedChain={targetChain}
        onSelectChain={onSelectTargetChain}
        availableChains={availableChains}
        walletAddress={walletAddress}
      />

      <GasSettings
        gasDropoffLevel={gasDropoffLevel}
        onGasDropoffLevelSelect={onGasDropoffLevelSelect}
      />
    </div>
  );
};
