import { FlatCompat } from "@eslint/eslintrc";
import eslintConfig from "eslint-config";
import prettierConfig from "eslint-config-prettier";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const ignoreConfig = {
  name: "front-end:ignore",
  ignores: ["coverage/", ".next/", "next-env.d.ts", "dist/"],
};

const tsParserConfig = {
  name: "front-end:ts-parser",
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: [
          "next.config.ts",
          "*.mjs",
          "examples/*.mjs",
          "scripts/*.ts",
          "scripts/ComponentTemplate/*.ts",
          "scripts/ComponentTemplate/*.tsx",
        ],
      },
    },
  },
};

const tsRulesConfig = {
  name: "front-end:ts-rules",
  files: ["**/*.ts", "**/*.tsx"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "import/order": [
      "error",
      {
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
        },
      },
    ],
  },
};

const tsxConfig = {
  name: "front-end:tsx",
  files: ["**/*.tsx"],
  rules: {
    "unicorn/filename-case": [
      "error",
      {
        case: "pascalCase",
        },
    ],
  },
};

const pagesConfig = {
  name: "front-end:pages",
  files: ["src/pages/*.tsx"],
  rules: {
    "unicorn/filename-case": "off",
    // "unicorn/filename-case": [
    //   "error",
    //   {
    //     case: "camelCase",
    //     },
    // ],
  },
}

const nextCoreWebVitalsConfig = compat.extends("next/core-web-vitals");
const nextTypescriptConfig = compat.extends("next/typescript");

/** Remove plugins that are already defined in base config */
const removeConflictingPlugins = (configs) =>
  configs.map((config) => {
    if (config.plugins) {
      delete config.plugins["import"];
      delete config.plugins["@typescript-eslint"];
    }
    return config;
  });

const filteredNextCoreWebVitals = removeConflictingPlugins(
  nextCoreWebVitalsConfig,
);
const filteredNextTypescript = removeConflictingPlugins(nextTypescriptConfig);

const importRestrictionsConfig = {
  name: "front-end:import-restrictions",
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["src/*", "**/src/*", "../../../*"],
            message: "Use @/* alias for cross-directory imports instead of literal 'src/' paths. Use relative imports (../) only up to 2 levels deep."
          }
        ]
      }
    ]
  }
};

const flatConfig = [
  ...filteredNextCoreWebVitals,
  ...filteredNextTypescript,
  ignoreConfig,
  ...eslintConfig,
  tsParserConfig,
  tsRulesConfig,
  tsxConfig,
  pagesConfig,
  importRestrictionsConfig,
  prettierConfig,
];

export default flatConfig;
