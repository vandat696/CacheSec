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

/** Expand a verified diff with unchanged lines so each review pane shows the whole file. */
export function completeComparisonDiff(hunks: DiffLine[][], base: string, candidate: string): DiffLine[] | null {
  const sourceLines = (source: string) => {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    return lines;
  };
  const oldLines = sourceLines(base);
  const newLines = sourceLines(candidate);
  const result: DiffLine[] = [];
  let before = 1, after = 1;
  function addContext(count: number) {
    if (count < 0 || before + count > oldLines.length + 1 || after + count > newLines.length + 1) return false;
    for (let index = 0; index < count; index++) {
      const text = oldLines[before - 1];
      if (text !== newLines[after - 1]) return false;
      result.push({ kind: "context", before: before++, after: after++, text });
    }
    return true;
  }
  for (const line of hunks.flat()) {
    const gap = line.before !== null ? line.before - before : line.after! - after;
    if (!addContext(gap)) return null;
    if (line.before !== null && (line.before !== before || oldLines[before++ - 1] !== line.text)) return null;
    if (line.after !== null && (line.after !== after || newLines[after++ - 1] !== line.text)) return null;
    result.push(line);
  }
  const tail = oldLines.length + 1 - before;
  return tail === newLines.length + 1 - after && addContext(tail) ? result : null;
}
