// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

export const Background = (): ReactElement => (
  <div className="backgrounds">
    <div className="radial-right"></div>
    <div className="radial-left"></div>
    <div className="topographic" style={{ top: "30%", left: "-10%" }}></div>
  </div>
);
