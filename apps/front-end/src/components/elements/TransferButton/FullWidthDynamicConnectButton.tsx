// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";
import type { ReactElement } from "react";

export const FullWidthDynamicConnectButton = (): ReactElement => {
  return (
    <div className="full-width-connect-wrapper">
      <DynamicConnectButton>
        <div className="main-cta">
          <span>Connect Wallet</span>
        </div>
      </DynamicConnectButton>
    </div>
  );
};
