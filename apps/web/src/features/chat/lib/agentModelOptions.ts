import type { AgentId } from "../ui/AgentSelectModal";

export type ReasoningLevel = "default" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AgentModelSettings {
  model?: string;
  reasoning?: ReasoningLevel;
}

export type AgentModelSettingsByAgent = Partial<Record<AgentId, AgentModelSettings>>;

export interface ModelOption {
  value: string;
  label: string;
  description: string;
}

export interface ReasoningOption {
  value: ReasoningLevel;
  label: string;
}

export const AGENT_MODEL_OPTIONS: Partial<Record<AgentId, ModelOption[]>> = {
  claude: [
    { value: "default", label: "기본값", description: "Claude CLI 설정을 그대로 사용" },
    { value: "sonnet", label: "Sonnet", description: "균형 잡힌 기본 작업용" },
    { value: "opus", label: "Opus", description: "복잡한 추론과 대규모 변경용" },
  ],
  codex: [
    { value: "default", label: "기본값", description: "Codex CLI 설정을 그대로 사용" },
    { value: "gpt-5.5", label: "GPT-5.5", description: "최신 고성능 모델" },
    { value: "gpt-5.4", label: "GPT-5.4", description: "범용 작업에 안정적" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "가벼운 수정과 빠른 응답" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex", description: "코딩 작업 특화" },
    { value: "gpt-5.2", label: "GPT-5.2", description: "이전 호환 모델" },
  ],
};

export const AGENT_REASONING_OPTIONS: Partial<Record<AgentId, ReasoningOption[]>> = {
  claude: [
    { value: "default", label: "기본" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "XHigh" },
    { value: "max", label: "Max" },
  ],
  codex: [
    { value: "default", label: "기본" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "XHigh" },
  ],
};

export function normalizeAgentModelSettings(settings?: AgentModelSettings): AgentModelSettings {
  return {
    model: settings?.model && settings.model !== "default" ? settings.model : undefined,
    reasoning: settings?.reasoning && settings.reasoning !== "default" ? settings.reasoning : undefined,
  };
}

export function getAgentModelSummary(agentId: AgentId, settings?: AgentModelSettings): string {
  const model = settings?.model ?? "default";
  const reasoning = settings?.reasoning ?? "default";
  const modelLabel =
    AGENT_MODEL_OPTIONS[agentId]?.find((option) => option.value === model)?.label ?? "기본값";
  const reasoningLabel =
    AGENT_REASONING_OPTIONS[agentId]?.find((option) => option.value === reasoning)?.label ?? "기본";
  return `${modelLabel} · ${reasoningLabel}`;
}
