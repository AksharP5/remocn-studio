# Compare real generations

The corpus tests material selection and staging across an agency film, portrait
typography, a photographic sequence and a factual graphic. The user supplies the
brief and materials; routine movement decisions remain Studio's responsibility.

Run `bun run generation:eval list`, then `bun run generation:eval prepare type v2`.
This creates a fresh Remotion project, the exact prompt, input/source hashes and an
empty result record under `out/generation-eval/`. Open that project in Studio and
submit `prompt.txt` without additional timing instructions. For the agency case,
pass the local brand asset folder as the fourth argument. Use the same folder
contents in both experiments. Preparation does not call a paid model or claim a
generation has happened.

Record the provider/model and observed results in `result.json`. Leave unavailable
values null. `firstPassUsable` is the human's judgment of the first complete export;
`userCorrections` counts subsequent user requests needed to make it usable, excluding
new scope. Record generation wall time and tokens only when measured by the harness.
Link the actual export and current full report, and record remaining measured errors.

Run `bun run generation:eval compare <run-a> <run-b>`. Comparison refuses mismatched
briefs/assets and exposes differing models. To compare art direction, view exports
under neutral labels before revealing the experimental condition; put the preference
and reason in notes. Repeat suitable cases to observe variability. A single successful
film and passing mechanical fixtures do not establish fewer user corrections.

`bun run motion:contract-proof` separately checks the runtime mechanics with real
Remotion renders, including deliberately broken phrase/caption fixtures. Its results
must not be entered as real generation outcomes.
