---
"remocn-studio": patch
---

The composer keeps what you hand it. Five ways it did not:

- A file dropped on the message field was silently filed in the asset library
  instead, and the drop ring never lit — the drag position arrives in CSS
  pixels, not the physical ones it was being scaled from.
- Pasting a picture with the caret inside an existing `[Image #N]` cut that
  token in half and silently dropped the attachment it stood for. The caret now
  snaps outside a reference before anything is inserted, on every path.
- The Model, Effort and Mode menus stayed open after a choice, so the next
  click — aimed at the text field they overlap — silently changed the setting
  again.
- macOS substitution turned `--flag` into `—flag` on the way to the agent, and
  the transcript stored the mangled text for good.
- `.m4v`, `.mkv`, `.avi`, `.mpeg`, `.flac`, `.aiff`, `.opus` and `.oga` are
  taken now; a `.heic` is still refused, but the refusal names the format and
  says to export it as JPEG or PNG.
