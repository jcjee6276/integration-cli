export interface TextDeltaEvent {
  sessionId: string;
  text: string;
}

export interface ResultEvent {
  sessionId: string;
  isError: boolean;
}

export interface SessionExitEvent {
  sessionId: string;
  exitCode: number;
}
