# The title bar's shader is a preference

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`shell/layout-and-panes`](../../openspec/specs/shell/layout-and-panes/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Appearance carries a *Title bar* group beside the theme: a sample of the band's own
field and two switches, *Show the shader* and *Animate it*. Both are on by default —
they are the studio's look — and both are `settings.json` keys, `titlebarShader`
(`shown`/`hidden`) and `titlebarMotion` (`enabled`/`disabled`), read by `usePreferences`
beside the crash consent. The shell passes `mood: null` when the shader is off, which is
the path an empty app already takes, and `isStill` when motion is off, which hands the
field a speed of zero — the same value the reduced-motion probe hands it, so a person's
choice and the OS's cannot disagree. `MoodField` is exported for the sample, so the
switches show their effect where the person is looking rather than behind the page.
