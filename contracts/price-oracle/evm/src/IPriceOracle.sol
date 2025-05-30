// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

interface IPriceOracle {

  //selector: 00000eb6
  function exec768() external payable returns (bytes memory);

  //selector: 0008a112
  function get1959() external view returns (bytes memory);

  //selector: f4189c473
  function checkedUpgrade(bytes calldata data) external;
}