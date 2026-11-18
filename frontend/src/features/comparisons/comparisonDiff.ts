export type DiffLine = {
  kind: "context" | "added" | "removed";
  before: number | null;
  after: number | null;
  text: string;
};

export function comparisonDiff(diff: string): DiffLine[][] | null {
  const lines = diff.replaceAll("\r\n", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length < 3 || !lines[0].startsWith("--- ") || !lines[1].startsWith("+++ ")) return null;

  const hunks: DiffLine[][] = [];
  let index = 2;
  while (index < lines.length) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[index++]);
    if (!header) return null;
    let before = Number(header[1]), beforeCount = Number(header[2] ?? 1);
    let after = Number(header[3]), afterCount = Number(header[4] ?? 1);
    const hunk: DiffLine[] = [];
    while (index < lines.length && !lines[index].startsWith("@@ ")) {
      const line = lines[index++];
      const marker = line[0], text = line.slice(1);
      if (marker === " ") {
        hunk.push({ kind: "context", before: before++, after: after++, text });
        beforeCount--;
        afterCount--;
      } else if (marker === "+") {
        hunk.push({ kind: "added", before: null, after: after++, text });
        afterCount--;
      } else if (marker === "-") {
        hunk.push({ kind: "removed", before: before++, after: null, text });
        beforeCount--;
      } else if (marker !== "\\" || text !== " No newline at end of file") {
        return null;
      }
    }
    if (beforeCount !== 0 || afterCount !== 0 || !hunk.length) return null;
    hunks.push(hunk);
  }
  return hunks;
}
