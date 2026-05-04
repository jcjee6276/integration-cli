import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import('typescript-eslint').ConfigArray} */
export default tseslint.config(
  {
    ignores: ["eslint.config.mjs", "dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    plugins: { import: importPlugin },
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: "commonjs",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "prettier/prettier": ["error", { endOfLine: "auto" }],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",

      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  eslintConfigPrettier,
);
