"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useClaudeAuth } from "@/features/auth/hooks/useClaudeAuth";
import { HarnessModal } from "@/features/harness/ui/HarnessModal";
import { AgentStatusModal } from "@/features/status/ui/AgentStatusModal";
import { TaskCreateModal } from "@/features/tasks/ui/TaskCreateModal";
import { TaskListModal } from "@/features/tasks/ui/TaskListModal";
import { useTaskNotification } from "@/features/tasks/hooks/useTaskNotification";
import { AgentSelectModal } from "../ui/AgentSelectModal";
import { FloatingActionPanel } from "../ui/FloatingActionPanel";
import type { AgentId } from "../ui/AgentSelectModal";
import { ChatWorkspace } from "../ui/ChatWorkspace";
import { CheckingSkeleton } from "../ui/CheckingSkeleton";
import { ClaudeLoginView } from "../ui/ClaudeLoginView";
import { SessionSidebar } from "../ui/SessionSidebar";
import { useAgentModelSettings } from "../hooks/useAgentModelSettings";
import { useSessionCommand } from "../hooks/useSessionCommand";
import { useSessionRename } from "../hooks/useSessionRename";
import { useSessionWorkingDirectories } from "../hooks/useSessionWorkingDirectories";
import { useUnifiedSessions } from "../hooks/useUnifiedSessions";

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
  const handleSend = useSessionCommand({
    selectedSession,
    selectedSessionId,
    sendMessage,
    modelSettingsByAgent: settingsByAgent,
    injectClaudeMessage,
    onShowStatus: () => setStatusPanelOpen(true),
  });
  const { hasNew, clearNew } = useTaskNotification();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [agentSelectOpen, setAgentSelectOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [harnessModalOpen, setHarnessModalOpen] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedSession?.messages, selectedSession?.streaming]);

  const handleOpenTaskList = useCallback(() => {
    setTaskListOpen(true);
    clearNew();
  }, [clearNew]);

  const handleAgentSelect = useCallback(
    (agentId: AgentId) => {
      const dir = currentDir || undefined;
      createSession(agentId, dir, settingsByAgent[agentId]).then((sessionId) => {
        if (sessionId && currentDir) {
          assignDirectoryToSession(sessionId, currentDir);
        }
      });
    },
    [currentDir, createSession, settingsByAgent, assignDirectoryToSession],
  );

  const closeAgentSelect = useCallback(() => setAgentSelectOpen(false), []);
  const closeStatusModal = useCallback(() => setStatusModalOpen(false), []);
  const closeHarnessModal = useCallback(() => setHarnessModalOpen(false), []);
  const closeTaskModal = useCallback(() => setTaskModalOpen(false), []);
  const closeTaskList = useCallback(() => setTaskListOpen(false), []);
  const openAgentSelect = useCallback(() => setAgentSelectOpen(true), []);
  const openTaskCreate = useCallback(() => setTaskModalOpen(true), []);
  const openStatusModal = useCallback(() => setStatusModalOpen(true), []);
  const openHarnessModal = useCallback(() => setHarnessModalOpen(true), []);
  const closeStatusPanel = useCallback(() => setStatusPanelOpen(false), []);

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
      {agentSelectOpen && (
        <AgentSelectModal
          open={agentSelectOpen}
          onClose={closeAgentSelect}
          onSelect={handleAgentSelect}
        />
      )}
      {statusModalOpen && <AgentStatusModal open={statusModalOpen} onClose={closeStatusModal} />}
      {harnessModalOpen && <HarnessModal open={harnessModalOpen} onClose={closeHarnessModal} />}
      {taskModalOpen && <TaskCreateModal open={taskModalOpen} onClose={closeTaskModal} />}
      {taskListOpen && <TaskListModal open={taskListOpen} onClose={closeTaskList} />}

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
        onOpenAgentSelect={openAgentSelect}
        onOpenTaskCreate={openTaskCreate}
        onOpenTaskList={handleOpenTaskList}
        onOpenStatus={openStatusModal}
        onOpenHarness={openHarnessModal}
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
        onCloseStatusPanel={closeStatusPanel}
        onSend={handleSend}
        onSendMessage={sendMessage}
        onDirChange={handleDirChange}
        onModelSettingsChange={updateSettings}
      />
    </div>
  );
}
