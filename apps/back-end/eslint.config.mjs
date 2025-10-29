// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import eslintConfig from "eslint-config";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

const ignoreConfig = {
  name: "back-end:ignore",
  ignores: ["dist/", "src/metadata.ts"],
};

const nestConfig = {
  name: "back-end:nest",
  languageOptions: {
    globals: {
      ...globals.node,
    },
    sourceType: "commonjs",
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.mjs", "examples/*.ts"],
      },
    },
  },
};

const overridesConfig = {
  name: "back-end:overrides",
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "unicorn/prefer-top-level-await": "off",
    "@typescript-eslint/no-extraneous-class": "off",
  },
};

const flatConfig = [
  ignoreConfig,
  ...eslintConfig,
  nestConfig,
  overridesConfig,
  prettierConfig,
];

export default flatConfig;
