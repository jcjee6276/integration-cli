import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = [
  {
    plugins: {
      prettier: eslintPluginPrettier,
      import: importPlugin,
    },
    rules: {
      "prettier/prettier": "error",

      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",

      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  eslintConfigPrettier,
];
