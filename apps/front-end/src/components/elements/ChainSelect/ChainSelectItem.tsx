// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import type { ReactElement } from "react";

import type { AvailableChains } from "@/constants";
import { chainLogos } from "@/constants";

export interface ChainSelectItemProps {
  chain: AvailableChains;
  isSelected: boolean;
  onSelect: (chain: AvailableChains) => void;
}

export const ChainSelectItem = ({
  chain,
  isSelected,
  onSelect,
}: ChainSelectItemProps): ReactElement => (
  <li onClick={() => onSelect(chain)} className={isSelected ? "selected" : ""}>
    <Image
      src={chainLogos[chain]}
      className="network-logo item-icon"
      alt={chain}
      unoptimized
      height={24}
      width={24}
    />
    <span>{chain}</span>
    {isSelected && (
      <Image
        src="/imgs/check.svg"
        alt="Selected"
        className="checkmark"
        unoptimized
        height={16}
        width={16}
      />
    )}
  </li>
);
