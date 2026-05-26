"use client";

import { useParams } from "next/navigation";

import { TaskDetailPageContainer } from "@/features/tasks/container/TaskDetailPageContainer";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();

  return <TaskDetailPageContainer taskId={params.id} />;
}
