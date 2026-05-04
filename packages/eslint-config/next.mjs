import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { baseConfig } from "./base.mjs";

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
  ...baseConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],

      "react/self-closing-comp": "error",
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }],
      "react/display-name": "off",
    },
  },
]);
