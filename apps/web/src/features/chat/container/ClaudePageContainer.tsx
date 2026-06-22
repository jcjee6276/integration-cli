"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useClaudeAuth } from "@/features/auth/hooks/useClaudeAuth";
import { HarnessModal } from "@/features/harness/ui/HarnessModal";
import { AgentStatusModal } from "@/features/status/ui/AgentStatusModal";
import { useTaskNotification } from "@/features/tasks/hooks/useTaskNotification";
import { TaskCreateModal } from "@/features/tasks/ui/TaskCreateModal";
import { TaskListModal } from "@/features/tasks/ui/TaskListModal";

import { useAgentModelSettings } from "../hooks/useAgentModelSettings";
import { useSessionCommand } from "../hooks/useSessionCommand";
import { useSessionRename } from "../hooks/useSessionRename";
import { useSessionWorkingDirectories } from "../hooks/useSessionWorkingDirectories";
import { useUnifiedSessions } from "../hooks/useUnifiedSessions";
import { AgentSelectModal } from "../ui/AgentSelectModal";
import type { AgentId } from "../ui/AgentSelectModal";
import { ChatWorkspace } from "../ui/ChatWorkspace";
import { CheckingSkeleton } from "../ui/CheckingSkeleton";
import { ClaudeLoginView } from "../ui/ClaudeLoginView";
import { FloatingActionPanel } from "../ui/FloatingActionPanel";
import { SessionSidebar } from "../ui/SessionSidebar";

export function ClaudePageContainer() {
  const { authState, loginState, loginOutput, loginUrls, startLogin, cancelLogin, checkAuth } =
    useClaudeAuth();

  useEffect(() => {
    if (loginState === "done") void checkAuth();
  }, [loginState, checkAuth]);

  const {
    sessions,
    selectedSession,
    selectedSessionId,
    selectedConnectionStatus,
    overallConnectionStatus,
    error,
    createSession,
    selectSession,
    sendMessage,
    terminateSession,
    renameSession,
    deleteSession,
    injectClaudeMessage,
  } = useUnifiedSessions();

  const { sessionDirs, currentDir, handleDirChange, assignDirectoryToSession } =
    useSessionWorkingDirectories(selectedSessionId);
  const { settingsByAgent, updateSettings } = useAgentModelSettings();
  const rename = useSessionRename(renameSession);
  const { hasNew, clearNew } = useTaskNotification();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [agentSelectOpen, setAgentSelectOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [harnessModalOpen, setHarnessModalOpen] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);

  const handleShowStatusPanel = useCallback(() => {
    setStatusPanelOpen(true);
  }, []);

  const handleCloseStatusPanel = useCallback(() => {
    setStatusPanelOpen(false);
  }, []);

  const handleSend = useSessionCommand({
    selectedSession,
    selectedSessionId,
    sendMessage,
    modelSettingsByAgent: settingsByAgent,
    injectClaudeMessage,
    onShowStatus: handleShowStatusPanel,
  });

  const handleOpenHarnessModal = useCallback(() => {
    setHarnessModalOpen(true);
  }, [setHarnessModalOpen]);

  const handleCloseHarnessModal = useCallback(() => {
    setHarnessModalOpen(false);
  }, [setHarnessModalOpen]);

  const handleOpenStatusModal = useCallback(() => {
    setStatusModalOpen(true);
  }, [setStatusModalOpen]);

  const handleCloseStatusModal = useCallback(() => {
    setStatusModalOpen(false);
  }, [setStatusModalOpen]);

  const handleOpenTaskCreate = useCallback(() => {
    setTaskModalOpen(true);
  }, [setTaskModalOpen]);

  const handleCloseTaskCreate = useCallback(() => {
    setTaskModalOpen(false);
  }, [setTaskModalOpen]);

  const handleCloseTaskList = useCallback(() => {
    setTaskListOpen(false);
  }, [setTaskListOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedSession?.messages, selectedSession?.streaming]);

  const handleOpenTaskList = useCallback(() => {
    setTaskListOpen(true);
    clearNew();
  }, [clearNew, setTaskListOpen]);

  const handleOpenAgentSelect = useCallback(() => {
    setAgentSelectOpen(true);
  }, [setAgentSelectOpen]);

  const handleCloseAgentSelect = useCallback(() => {
    setAgentSelectOpen(false);
  }, [setAgentSelectOpen]);

  const handleAgentSelect = useCallback(
    (agentId: AgentId) => {
      const dir = currentDir || undefined;
      void (async () => {
        try {
          const sessionId = await createSession(agentId, dir, settingsByAgent[agentId]);
          if (sessionId && currentDir) {
            assignDirectoryToSession(sessionId, currentDir);
          }
        } catch (error) {
          console.error("Failed to create agent session", error);
        }
      })();
    },
    [assignDirectoryToSession, createSession, currentDir, settingsByAgent],
  );

  const inputDisabled =
    !selectedSession || selectedSession.isWaiting || selectedConnectionStatus !== "connected";

  if (authState === "checking") return <CheckingSkeleton />;

  if (authState === "unauthenticated") {
    return (
      <ClaudeLoginView
        loginState={loginState}
        loginOutput={loginOutput}
        loginUrls={loginUrls}
        onStart={startLogin}
        onCancel={cancelLogin}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">
      <AgentSelectModal
        open={agentSelectOpen}
        onClose={handleCloseAgentSelect}
        onSelect={handleAgentSelect}
      />
      <AgentStatusModal open={statusModalOpen} onClose={handleCloseStatusModal} />
      <HarnessModal open={harnessModalOpen} onClose={handleCloseHarnessModal} />
      {taskModalOpen && <TaskCreateModal open={true} onClose={handleCloseTaskCreate} />}
      {taskListOpen && <TaskListModal open={true} onClose={handleCloseTaskList} />}

      <SessionSidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        overallConnectionStatus={overallConnectionStatus}
        hasNewTask={hasNew}
        menuOpenId={rename.menuOpenId}
        renamingId={rename.renamingId}
        renameValue={rename.renameValue}
        menuRef={rename.menuRef}
        onSelectSession={selectSession}
        onOpenAgentSelect={handleOpenAgentSelect}
        onOpenTaskCreate={handleOpenTaskCreate}
        onOpenTaskList={handleOpenTaskList}
        onOpenStatus={handleOpenStatusModal}
        onOpenHarness={handleOpenHarnessModal}
        onSetMenuOpenId={rename.setMenuOpenId}
        onStartRename={rename.startRename}
        onRenameValueChange={rename.setRenameValue}
        onConfirmRename={rename.confirmRename}
        onCancelRename={rename.cancelRename}
        onDeleteSession={deleteSession}
      />

      <FloatingActionPanel />
      <ChatWorkspace
        selectedSession={selectedSession}
        selectedSessionDir={selectedSession ? (sessionDirs[selectedSession.info.id] ?? "") : ""}
        overallConnectionStatus={overallConnectionStatus}
        currentDir={currentDir}
        error={error}
        inputDisabled={inputDisabled}
        bottomRef={bottomRef}
        modelSettingsByAgent={settingsByAgent}
        statusPanelOpen={statusPanelOpen}
        onTerminateSession={terminateSession}
        onCloseStatusPanel={handleCloseStatusPanel}
        onSend={handleSend}
        onSendMessage={sendMessage}
        onDirChange={handleDirChange}
        onModelSettingsChange={updateSettings}
      />
    </div>
  );
}
