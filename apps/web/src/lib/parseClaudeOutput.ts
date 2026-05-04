// Comprehensive ANSI/VT100 escape sequence pattern
const ANSI_RE =
  /[](?:[@-Z\\-_]|\[[0-9;]*[ -/]*[@-~]|\][^]*[\\])/g;

const SPINNER_CHARS = new Set(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']);

export type MessageRole = 'user' | 'assistant';

export interface ParsedMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
}

export interface ToolUseBlock {
  tool: string;
  input?: string;
  output?: string;
}

/** Strip all ANSI escape sequences from a string */
export function stripAnsi(raw: string): string {
  return raw.replace(ANSI_RE, '');
}

/**
 * Resolve carriage-return overwrites — when \r is used to rewrite a line
 * (e.g. spinner animations), keep only the final content of each line.
 */
function resolveCarriageReturns(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const parts = line.split('\r');
      // Last non-empty segment is the visible content
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].trim()) return parts[i];
      }
      return '';
    })
    .join('\n');
}

/** True if the line contains only spinner / progress noise */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Spinner character at start (thinking indicator)
  if (SPINNER_CHARS.has(trimmed[0])) return true;

  // Raw shell prompt echoed back
  if (/^>\s*$/.test(trimmed)) return true;

  // Horizontal rule separators the CLI draws between turns
  if (/^[─═━─\-]{5,}$/.test(trimmed)) return true;

  return false;
}

/**
 * Clean raw PTY data into a plain string suitable for display.
 * Strips ANSI codes, resolves \r overwrites, and drops noise-only lines.
 */
export function cleanPtyOutput(raw: string): string {
  const stripped = stripAnsi(raw);
  const resolved = resolveCarriageReturns(stripped);

  const lines = resolved.split('\n').filter((line) => !isNoiseLine(line));

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract tool-use blocks from cleaned output text */
export function extractToolBlocks(text: string): ToolUseBlock[] {
  const blocks: ToolUseBlock[] = [];

  // Claude CLI emits tool use in the form:
  //   Tool: <name>
  //   $ <command>   (for bash)
  //   or key: value lines for other tools
  const toolPattern = /Tool:\s*(\w[\w\s]*)\n([\s\S]*?)(?=\nTool:|\n> |$)/g;
  let match: RegExpExecArray | null;

  while ((match = toolPattern.exec(text)) !== null) {
    const tool = match[1].trim();
    const body = match[2].trim();

    const block: ToolUseBlock = { tool };

    // Bash commands start with $
    const cmdLine = body.match(/^\$\s*(.+)/m);
    if (cmdLine) block.input = cmdLine[1].trim();

    blocks.push(block);
  }

  return blocks;
}

/**
 * Detect whether the PTY chunk indicates Claude is still processing
 * (spinner visible → true, prompt restored → false).
 */
export function isThinking(raw: string): boolean {
  const stripped = stripAnsi(raw);
  // Spinner on the last non-empty part of any \r-overwritten line
  const lines = stripped.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const parts = lines[i].split('\r');
    const visible = parts[parts.length - 1];
    const ch = visible.trimStart()[0];
    if (ch && SPINNER_CHARS.has(ch)) return true;
    if (visible.trim()) break; // non-empty, non-spinner — not thinking
  }
  return false;
}
