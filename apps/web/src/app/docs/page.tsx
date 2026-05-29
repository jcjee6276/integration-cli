import type { Metadata } from "next";

import { ProjectDocsPageContainer } from "@/features/docs/container/ProjectDocsPageContainer";

export const metadata: Metadata = {
  title: "JI CLI Docs",
  description: "JI CLI 프로젝트 구조와 API 흐름 문서",
};

export default function DocsPage() {
  return <ProjectDocsPageContainer />;
}
