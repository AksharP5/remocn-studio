# DESIGN.md import

Approved: local DESIGN.md selection in Project Brand, deterministic token parsing,
preview with editable role mappings and explicit replacements. Import updates the
settings draft; the existing Save/Cancel flow owns persistence. Existing videos
remain pinned until an explicit brand application.

Use the Google Labs alpha specification: optional YAML front matter and Markdown
body. Resolve token references with cycle checks, normalize supported CSS colors
to the existing sRGB hex model, expose typography family/weight candidates.
Preserve the complete original document and its immutable local file reference in
the brand snapshot, including layout/component/prose data without editable fields.
Do not fetch linked resources. Missing font files remain visible in the editor.

Implementation: shared preview schema and merge helper; bounded sidecar reader and
parser; IPC method; importer UI in the existing editor; tests for parsing,
conflicts, cancellation, snapshot portability and errors; typecheck/lint/builds.
