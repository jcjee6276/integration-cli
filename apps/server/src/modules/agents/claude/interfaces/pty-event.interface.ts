export interface PtyOutputEvent {
  sessionId: string;
  data: string;
  timestamp: Date;
}

export interface PtyExitEvent {
  sessionId: string;
  exitCode: number;
}
