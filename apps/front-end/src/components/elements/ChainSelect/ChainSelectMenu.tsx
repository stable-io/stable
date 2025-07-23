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
