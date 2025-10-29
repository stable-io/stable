// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

import { ChainSelectItem } from "./ChainSelectItem";

import type { AvailableChains } from "@/constants";

export interface ChainSelectMenuProps {
  chains: readonly AvailableChains[];
  selectedChain: AvailableChains;
  onSelect: (chain: AvailableChains) => void;
}

export const ChainSelectMenu = ({
  chains,
  selectedChain,
  onSelect,
}: ChainSelectMenuProps): ReactElement => (
  <div className="select-menu">
    <ul className="networks">
      {chains.map((chain) => (
        <ChainSelectItem
          key={chain}
          chain={chain}
          isSelected={chain === selectedChain}
          onSelect={onSelect}
        />
      ))}
    </ul>
  </div>
);
