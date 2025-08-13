// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import eslintConfig from "eslint-config";

const ignoreConfig = {
  ignores: ["dist/", "litesvm-source/", "src/liteSvm/internal.*"],
};

const tsConfig = {
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.mjs"],
      },
    },
  },
};

const overridesConfig = {
  rules: {
    "@stylistic/max-len": ["error", { code: 120 }],
    "@typescript-eslint/only-throw-error": "off",
    "unicorn/no-array-callback-reference": "off",
    "unicorn/no-await-expression-member": "off",
    "unicorn/no-null": "off",
  },
};

export default [...eslintConfig, ignoreConfig, tsConfig, overridesConfig];
