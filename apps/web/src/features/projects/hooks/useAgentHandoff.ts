"use client";

import { useCallback, useState } from "react";

import { createAgentHandoff, createBatchHandoff } from "../api/agentHandoff.api";
import type {
  AgentHandoffBatchPayload,
  AgentHandoffBatchResult,
  AgentHandoffPayload,
  AgentHandoffResult,
  HandoffAgentId,
} from "../api/agentHandoff.api";

export function useAgentHandoff() {
  const [submittingAgent, setSubmittingAgent] = useState<HandoffAgentId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handoff = useCallback(async (payload: AgentHandoffPayload): Promise<AgentHandoffResult> => {
    try {
      setError(null);
      setSubmittingAgent(payload.agentId);
      return await createAgentHandoff(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "에이전트 핸드오프에 실패했습니다";
      setError(message);
      throw err;
    } finally {
      setSubmittingAgent(null);
    }
  }, []);

  const handoffBatch = useCallback(
    async (payload: AgentHandoffBatchPayload): Promise<AgentHandoffBatchResult> => {
      try {
        setError(null);
        setSubmittingAgent(payload.agentId);
        return await createBatchHandoff(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "일괄 핸드오프에 실패했습니다";
        setError(message);
        throw err;
      } finally {
        setSubmittingAgent(null);
      }
    },
    [],
  );

  return {
    submittingAgent,
    error,
    handoff,
    handoffBatch,
  };
}
