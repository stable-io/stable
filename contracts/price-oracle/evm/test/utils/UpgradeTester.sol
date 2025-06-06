// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.24;

import { ProxyBase } from "wormhole-sdk/proxy/ProxyBase.sol";

contract UpgradeTester is ProxyBase {
  event Constructed(bytes data);
  event Upgraded(bytes data);

  function upgradeTo(address newImplementation, bytes calldata data) external {
    _upgradeTo(newImplementation, data);
  }

  function getImplementation() external view returns (address) {
    return _getImplementation();
  }

  function _proxyConstructor(bytes calldata data) internal override {
    emit Constructed(data);
  }

  function _contractUpgrade(bytes calldata data) internal override {
    emit Upgraded(data);
  }
}
