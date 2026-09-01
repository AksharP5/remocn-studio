export interface EasingFinding {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

// `easing:` and enough of what follows to tell a constant from a prop. The
// value is read to the end of the line, which is where a formatted
// `interpolate()` config puts it.
const EASING = /\beasing\s*:\s*([^\n]*)/g;
const CONSTANT = /\bEasing\s*\./;
const FROM_PROP = /\.\.\./;
const TRAILING = /,\s*$/;

/**
 * The easings this project hardcoded, which are exactly the curves the
 * properties panel can never edit.
 *
 * The vendored `remotion-interactivity` skill tells the agent to hardcode the
 * easing — correct for Remotion Studio, which rewrites the call site, and
 * wrong here, where the panel edits props at runtime. An instruction that
 * contradicts a skill the same turn loaded is a coin flip, so this is the
 * mechanical half: `design_check` reports these as findings, and the agent
 * already has to fix every finding or say why it is intentional. Nobody should
 * have to read the generated code to find out whether the panel will work.
 */
export function hardcodedEasings(
  file: string,
  source: string
): EasingFinding[] {
  const found: EasingFinding[] = [];

  for (const match of source.matchAll(EASING)) {
    const value = match[1] ?? "";

    // A spread is the tunable shape — `Easing.bezier(...easing)` takes the
    // curve from a prop, so it is the answer rather than the problem.
    if (!CONSTANT.test(value) || FROM_PROP.test(value)) {
      continue;
    }

    found.push({
      file,
      line: lineOf(source, match.index),
      snippet: `easing: ${value.trim().replace(TRAILING, "")}`,
    });
  }

  return found;
}

export function easingFindings(
  files: readonly { readonly path: string; readonly source: string }[]
): EasingFinding[] {
  return files.flatMap((file) => hardcodedEasings(file.path, file.source));
}

/** The sentence the agent reads, naming every curve it has to lift out. */
export function easingReport(
  findings: readonly EasingFinding[]
): string | null {
  if (findings.length === 0) {
    return null;
  }

  const lines = findings.map(
    (finding) => `  ${finding.file}:${finding.line} — ${finding.snippet}`
  );

  const subject =
    findings.length === 1
      ? "1 animation hardcodes"
      : `${findings.length} animations hardcode`;

  return [
    `${subject} the easing, so the timing curve cannot be edited in the properties panel:`,
    ...lines,
    'Give each component an `easing` prop declared in its `InteractivitySchema` as a four-number cubic-bezier array (`type: "array"`, minLength and maxLength 4, a `number` item), default it inline, and spread it in as `Easing.bezier(...easing)`.',
  ].join("\n");
}

function lineOf(source: string, index: number): number {
  let line = 1;

  for (let at = 0; at < index; at += 1) {
    if (source[at] === "\n") {
      line += 1;
    }
  }

  return line;
}
