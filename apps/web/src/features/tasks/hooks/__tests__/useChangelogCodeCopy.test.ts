import { describe, expect, it } from "vitest";

import { extractCopyableCodeFromPatch } from "../useChangelogCodeCopy";

describe("extractCopyableCodeFromPatch", () => {
  it("diff 메타데이터와 삭제 라인을 제거하고 붙여넣기 가능한 코드만 반환한다", () => {
    const patch = [
      "diff --git a/src/App.tsx b/src/App.tsx",
      "index abc..def 100644",
      "--- a/src/App.tsx",
      "+++ b/src/App.tsx",
      "@@ -1,4 +1,5 @@",
      " import React from \"react\";",
      "-const title = \"old\";",
      "+const title = \"new\";",
      "+const enabled = true;",
      " export function App() {",
      "   return title;",
      " }",
    ].join("\n");

    expect(extractCopyableCodeFromPatch(patch)).toBe([
      "import React from \"react\";",
      "const title = \"new\";",
      "const enabled = true;",
      "export function App() {",
      "  return title;",
      "}",
    ].join("\n"));
  });

  it("새 파일 patch는 파일 내용만 반환한다", () => {
    const patch = [
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,2 @@",
      "+export const value = 1;",
      "+export const name = \"ji\";",
    ].join("\n");

    expect(extractCopyableCodeFromPatch(patch)).toBe([
      "export const value = 1;",
      "export const name = \"ji\";",
    ].join("\n"));
  });
});
