"use client";

import { useProjectDocs } from "../hooks/useProjectDocs";
import { ProjectDocsView } from "../ui/ProjectDocsView";

export function ProjectDocsPageContainer() {
  const docs = useProjectDocs();

  return (
    <ProjectDocsView
      metrics={docs.metrics}
      sections={docs.sections}
      filteredSections={docs.filteredSections}
      query={docs.query}
      activeSection={docs.activeSection}
      activeSectionTitle={docs.activeSectionTitle}
      onQueryChange={docs.setQuery}
      onSectionChange={docs.setActiveSection}
    />
  );
}
