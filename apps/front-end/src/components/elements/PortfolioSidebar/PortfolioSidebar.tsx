// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

export const PortfolioSidebar = (): ReactElement => {
  return (
    <div className="sidebar content-box">
      <ul className="tabs">
        <li className="active">My Portfolio</li>
        <li>History</li>
      </ul>
      <div className="sidebar-content">
        <p
          style={{
            textAlign: "center",
            padding: "260px 0px",
            opacity: ".6",
          }}
        >
          Portfolio view goes here..
        </p>
      </div>
    </div>
  );
};
