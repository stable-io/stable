// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import eslintConfig from "eslint-config";

const ignoreConfig = {
  ignores: ["coverage/", "dist/"],
};

const tsConfig = {
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.mjs", "jest.config.ts"],
      },
    },
  },
};

const srcConfig = {
  files: ["src/**/*"],
  rules: {
    "unicorn/prefer-node-protocol": "off",
  },
};

const examplesConfig = {
  files: ["examples/*"],
  rules: {
    "unicorn/no-process-exit": "off",
  },
};

export default [...eslintConfig, ignoreConfig, tsConfig, srcConfig, examplesConfig];
