/*
 * @Author: 전지창
 * @Date: 2026-05-04 15:13:40
 * @LastEditTime: 2026-05-04 18:12:10
 * @LastEditors: 전지창
 * @Description:
 */
import nextConfig from "@ji/eslint-config/next";

export default [
  ...nextConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: path.join(import.meta.dirname, ".."),
      },
    },
  },
];
