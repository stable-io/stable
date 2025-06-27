import eslintConfig from "eslint-config";
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
        allowDefaultProject: ["*.mjs"],
      },
    },
  },
};

const overridesConfig = {
  name: "back-end:overrides",
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "unicorn/prefer-top-level-await": "off",
  },
};

const flatConfig = [ignoreConfig, ...eslintConfig, nestConfig, overridesConfig];

export default flatConfig;
