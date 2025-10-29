// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

import type { GasDropoffLevel } from "@/constants";

const gasDropoffOptions: GasDropoffLevel[] = ["zero", "low", "avg", "high"];

interface GasLevelOptionsProps {
  gasDropoffLevel: GasDropoffLevel;
  onGasDropoffLevelSelect: (level: GasDropoffLevel) => void;
}

export const GasLevelOptions = ({
  gasDropoffLevel,
  onGasDropoffLevelSelect,
}: GasLevelOptionsProps): ReactElement => {
  return (
    <div className="options">
      {gasDropoffOptions.map((level) => (
        <button
          key={level}
          className={`option ${gasDropoffLevel === level ? "active" : ""}`}
          onClick={() => onGasDropoffLevelSelect(level)}
        >
          {level.charAt(0).toUpperCase() + level.slice(1)}
        </button>
      ))}
    </div>
  );
};
