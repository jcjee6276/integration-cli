import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const JI_HOME = path.join(os.homedir(), '.ji');

export const JI_PATHS = {
  home:        JI_HOME,
  db:          path.join(JI_HOME, 'ji.db'),
  logs:        path.join(JI_HOME, 'logs'),
  serverLog:   path.join(JI_HOME, 'logs', 'server.log'),
  worktrees:   path.join(JI_HOME, 'worktrees'),
  patches:     path.join(JI_HOME, 'patches'),
  harness:     path.join(JI_HOME, 'harness'),
  agents: {
    gemini: {
      dir:      path.join(JI_HOME, 'agents', 'gemini'),
      apiKey:   path.join(JI_HOME, 'agents', 'gemini', 'api-key'),
      settings: path.join(JI_HOME, 'agents', 'gemini', 'settings.json'),
    },
    codex: {
      dir:    path.join(JI_HOME, 'agents', 'codex'),
      apiKey: path.join(JI_HOME, 'agents', 'codex', 'api-key'),
    },
  },
} as const;

export function ensureJiDirs(): void {
  const dirs = [
    JI_PATHS.home,
    JI_PATHS.logs,
    JI_PATHS.worktrees,
    JI_PATHS.patches,
    JI_PATHS.harness,
    JI_PATHS.agents.gemini.dir,
    JI_PATHS.agents.codex.dir,
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
