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
