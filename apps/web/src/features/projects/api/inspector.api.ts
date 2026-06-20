import { SERVER_URL } from "@/lib/constants";

export type InspectorState = "idle" | "connecting" | "active";

export interface InspectorStatus {
  state: InspectorState;
  appUrl?: string;
  error?: string;
}

export interface InspectorElement {
  fileName?: string;
  line?: number;
  column?: number;
  endLine?: number;
  componentName?: string;
  notFound?: boolean;
  tagName?: string;
  text?: string;
}

export async function startInspectorSession(appUrl: string): Promise<InspectorStatus> {
  const res = await fetch(`${SERVER_URL}/inspector/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appUrl }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function stopInspectorSession(): Promise<{ state: InspectorState }> {
  const res = await fetch(`${SERVER_URL}/inspector/session/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
