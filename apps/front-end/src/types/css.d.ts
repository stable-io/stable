// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

declare module "*.css" {
  const content: any;
  export default content;
}

declare module "*.module.css" {
  const content: { [className: string]: string };
  export default content;
}
