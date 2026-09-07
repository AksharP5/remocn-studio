import type { CodeStatusKind, TuningValue } from "./ipc";

/**
 * What the studio can write itself, and what has to be a sentence to the agent.
 *
 * The rule is one function because both ends read it: the pane splits an Add
 * into two chips with it, and the prompt says which half the agent is being
 * asked for. `@remotion/studio-codemods` never reads a schema's `default` — it
 * reads the JSX attributes at the call site — so what decides is the status it
 * reports for the key, not the value the runtime happens to be holding.
 */
export type WriteRoute = "agent" | "code";

export interface Routed {
  readonly reason: string | null;
  readonly route: WriteRoute;
}

// Remotion's own list, reimplemented because `checkIfTypeScriptFile` is not
// exported. Five lines against a deep import into `dist/`.
const TYPESCRIPT = [".mts", ".mtsx", ".ts", ".tsx"];

export function isTypeScriptFile(file: string): boolean {
  return TYPESCRIPT.some((extension) => file.endsWith(extension));
}

export const NO_CALL_SITE =
  "the studio could not find this element in the code";
export const NOT_TYPESCRIPT = "the file is not TypeScript";
export const COMPUTED_IN_CODE = "the code computes this value";
export const FONT_NOT_LOADED = "that font is not loaded in the preview";
export const NO_STATUS = "the studio could not read this value in the code";
export const ASSET_IS_A_CALL = "an asset is written as staticFile(…)";

const TO_CODE: Routed = { reason: null, route: "code" };

/**
 * Where one changed field goes.
 *
 * `static` covers a prop with no attribute at the call site as well as one with
 * a literal — the codemod adds the attribute — so the discriminator is the
 * status alone, not whether a `codeValue` came back with it.
 */
export function routeOf(input: {
  readonly file: string | null;
  readonly fonts: readonly string[];
  readonly kind: CodeStatusKind | null;
  readonly type: string;
  readonly value: TuningValue;
  readonly writable: boolean;
}): Routed {
  if (input.file !== null && !isTypeScriptFile(input.file)) {
    return { reason: NOT_TYPESCRIPT, route: "agent" };
  }

  if (!input.writable) {
    return { reason: NO_CALL_SITE, route: "agent" };
  }

  if (input.kind === null) {
    return { reason: NO_STATUS, route: "agent" };
  }

  if (input.kind === "computed") {
    return { reason: COMPUTED_IN_CODE, route: "agent" };
  }

  // A family the preview has never loaded would be written into the file and
  // then render as the fallback, silently. Naming a Google Font in the code is
  // an import and a `loadFont()` call, which is the agent's job — the studio
  // ships no font directory to look one up in.
  if (input.type === "font-family" && !isLoaded(input.fonts, input.value)) {
    return { reason: FONT_NOT_LOADED, route: "agent" };
  }

  // The pane holds an asset as the name of a file in `public/`, and the code
  // holds the call that resolves it. Writing the name where the call is would
  // leave a string the bundler serves from nowhere; `src={staticFile(…)}` is
  // read as computed anyway, so this only catches a literal `src="…"`.
  if (input.type === "asset") {
    return { reason: ASSET_IS_A_CALL, route: "agent" };
  }

  return TO_CODE;
}

function isLoaded(fonts: readonly string[], value: TuningValue): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const asked = familiesIn(value);

  return (
    asked.length > 0 &&
    asked.every((family) =>
      fonts.some((loaded) => loaded.toLowerCase() === family)
    )
  );
}

const QUOTES = /^['"]|['"]$/g;

function familiesIn(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().replace(QUOTES, "").trim().toLowerCase())
    .filter((part) => part.length > 0);
}
