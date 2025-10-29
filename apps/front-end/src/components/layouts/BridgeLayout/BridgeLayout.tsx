// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { PropsWithChildren, ReactElement } from "react";

import { Background } from "../../elements/Background";
import { Footer } from "../../sections/Footer";
import { Header } from "../../sections/Header";

import { Announcement } from "@/components/sections";

export type BridgeLayoutProps = PropsWithChildren<object>;

export const BridgeLayout = ({ children }: BridgeLayoutProps): ReactElement => (
  <div className="bridge-app main">
    <Background />
    <Announcement />
    <div className="container">
      <Header />
      <div className="main-content">{children}</div>
      <Footer />
    </div>
  </div>
);
