import { SERVER_URL } from "@/lib/constants";

export type HarnessRole = "common" | "frontend" | "backend" | "doc" | "operation" | "other";
export type HarnessExt = "md" | "tsx";

export interface Harness {
  role: HarnessRole;
  ext: HarnessExt;
  content: string;
}

export const HARNESS_ROLES: { role: HarnessRole; label: string }[] = [
  { role: "common",    label: "공통" },
  { role: "frontend",  label: "Frontend" },
  { role: "backend",   label: "Backend" },
  { role: "doc",       label: "Doc" },
  { role: "operation", label: "Operation" },
  { role: "other",     label: "Other" },
];

export async function fetchAllHarnesses(): Promise<Harness[]> {
  const res = await fetch(`${SERVER_URL}/harness`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchHarness(role: HarnessRole): Promise<Harness> {
  const res = await fetch(`${SERVER_URL}/harness/${role}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveHarness(role: HarnessRole, content: string, ext: HarnessExt): Promise<Harness> {
  const res = await fetch(`${SERVER_URL}/harness/${role}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ext }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteHarness(role: HarnessRole): Promise<void> {
  await fetch(`${SERVER_URL}/harness/${role}`, { method: "DELETE" });
}
