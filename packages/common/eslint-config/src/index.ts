// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Linter } from "eslint";
import type { ConfigArray, ConfigWithExtends } from "typescript-eslint";

import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import promisePlugin from "eslint-plugin-promise";
import regexpPlugin from "eslint-plugin-regexp";
import unicornPlugin from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

const linterOptionsConfig: Linter.Config = {
  name: "base:linter-options",
  linterOptions: {
    reportUnusedDisableDirectives: "error",
    reportUnusedInlineConfigs: "error",
  },
};

const tsConfig: Linter.Config = {
  name: "base:ts",
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
};

const jsConfig: ConfigWithExtends = {
  name: "base:js",
  extends: [
    tseslint.configs.disableTypeChecked,
  ],
  files: ["**/*.{cjs,mjs,js,jsx}"],
};

const ruleOverridesConfig: Linter.Config = {
  name: "base:rule-overrides",
  rules: {
    "no-console": ["warn", { allow: ["error", "info", "table", "warn"] }],
    "@stylistic/array-bracket-spacing": "off",
    "@stylistic/indent": "off",
    "@stylistic/indent-binary-ops": "off",
    "@stylistic/key-spacing": "off",
    "@stylistic/max-len": ["error", { code: 100, ignoreStrings: true, ignoreUrls: true }],
    "@stylistic/no-multi-spaces": "off",
    "@stylistic/operator-linebreak": "off",
    "@stylistic/space-infix-ops": "off",
    "@stylistic/spaced-comment": "off",
    "@stylistic/type-generic-spacing": "off",
    "@stylistic/brace-style": "off",
    "@typescript-eslint/no-confusing-void-expression": "off",
    "@typescript-eslint/no-empty-object-type": [
      "error", { allowInterfaces: "with-single-extends" },
    ],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
    "@typescript-eslint/no-invalid-void-type": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: "only-allowed-literals" }],
    "@typescript-eslint/no-unnecessary-type-arguments": "off",
    "@typescript-eslint/no-unnecessary-type-parameters": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "import/no-unresolved": "off", // Not recommended in combination with typescript-eslint
    "promise/always-return": ["error", { ignoreLastCallback: true }],
    "promise/catch-or-return": ["error", { allowFinally: true }],
    "unicorn/consistent-function-scoping": "off",
    "unicorn/filename-case": ["error", { case: "camelCase" }],
    "unicorn/no-array-callback-reference": "off",
    "unicorn/no-array-reduce": "off",
    "unicorn/no-await-expression-member": "off",
    "unicorn/no-nested-ternary": "off",
    "unicorn/numeric-separators-style": "off",
    "unicorn/prefer-spread": "off",
    "unicorn/prevent-abbreviations": "off",
    "unicorn/switch-case-braces": "off",
  },
};

const defaultConfig: ConfigArray = tseslint.config(
  { name: "base:default" },
  linterOptionsConfig,
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  stylistic.configs.customize({
    indent: 2,
    jsx: false,
    quotes: "double",
    semi: true,
  }),
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  promisePlugin.configs["flat/recommended"],
  regexpPlugin.configs["flat/recommended"],
  unicornPlugin.configs.recommended,
  tsConfig,
  jsConfig,
  ruleOverridesConfig,
);

export default defaultConfig;
