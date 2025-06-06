import type { ReactElement } from "react";

import { ChainSelectItem } from "./ChainSelectItem";

import type { AvailableChains } from "@/constants";

export interface ChainSelectMenuProps {
  chains: readonly AvailableChains[];
  onSelect: (chain: AvailableChains) => void;
}

export const ChainSelectMenu = ({
  chains,
  onSelect,
}: ChainSelectMenuProps): ReactElement => (
  <div className="select-menu">
    <ul className="networks">
      {chains.map((chain) => (
        <ChainSelectItem key={chain} chain={chain} onSelect={onSelect} />
      ))}
    </ul>
  </div>
);
