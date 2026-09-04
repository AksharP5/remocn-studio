// macOS text substitution is on by default in a WKWebView text field, and this
// app's fields are the worst possible place for it: everything typed into them
// describes code or a command to an agent, or is a value written back into TSX.
// Measured — `git status --short` was sent, and stored in the transcript, as
// `git status —short`. The same substitution turns `"` into `"`, `'` into `'`
// and `...` into `…`, none of which parse.
//
// `autocorrect` is the attribute WebKit reads for this; `autocapitalize` stops
// a sentence being capitalised on the way in. Spellcheck is deliberately left
// alone — it is a separate switch, and nobody asked for the squiggles to go.
export const VERBATIM_INPUT = {
  autoCapitalize: "off",
  autoCorrect: "off",
} as const;
