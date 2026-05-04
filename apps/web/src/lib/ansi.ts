// CSI sequences:  ESC [ ... m/A/B/K ...
// OSC sequences:  ESC ] ... BEL
// Single ESC:     ESC x
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;?]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B[^[\]]/g;

export function stripAnsi(raw: string): string {
  return (
    raw
      .replace(ANSI_RE, "")
      // CR+LF → LF, 단독 CR → LF
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
  );
}
