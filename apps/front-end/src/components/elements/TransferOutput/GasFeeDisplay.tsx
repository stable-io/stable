// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

interface FeeRowProps {
  currency: string;
  value: string;
}

const FeeRow = ({ currency, value }: FeeRowProps): ReactElement => {
  return (
    <div className="fee-row">
      <span className="currency">{currency}</span>
      <span className="value">{value}</span>
    </div>
  );
};

export const GasFeeDisplay = (): ReactElement => {
  return (
    <div className="gas-settings-fees">
      <FeeRow currency="USDC" value="0.0" />
      <FeeRow currency="OPT" value="~0.0" />
    </div>
  );
};
