/*
 * @Author: 전지창
 * @Date: 2026-05-04 17:17:33
 * @LastEditTime: 2026-05-04 17:21:47
 * @LastEditors: 전지창
 * @Description:
 */
import nestConfig from "@ji/eslint-config/nest";

export default [
  ...nestConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: path.join(import.meta.dirname, ".."),
      },
    },
  },
];
