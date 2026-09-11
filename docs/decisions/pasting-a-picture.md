# Pasting a picture, and pointing at it

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`composer/references`](../../openspec/specs/composer/references/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Cmd+V attaches whatever image is on the clipboard and drops `[Image #1]` at the caret;
the sentence the user writes is what says which picture they mean, and the turn is built
by cutting the text at each reference and splicing the image in there (#13).

- **The reference format lives in `shared/references.ts`**, next to the IPC contract and
  the transcript fold, for the same reason the fold is shared: it is parsed in two
  processes — the webview colours it, `sidecar/claude/content.ts` splices into it — and
  two implementations that had to agree would drift. Everything about the format is a pure
  function there: render, segment, insert at a caret, locate the reference a keystroke
  should take, drop one (or several) and renumber, and diff two drafts for the references
  that left. A number outside the attachment count is **not** a reference: `[Image #7]`
  with three attached is plain text everywhere, coloured nowhere and spliced nowhere.
- **The invariant is positional.** `items[i]` is always `[Image #{i+1}]`, which is what
  makes the sidecar's splice a lookup by number rather than through a side table, and why
  references carry no identity. Removing an attachment removes its reference and shifts
  every higher one down, so the list and the text cannot disagree.
- **Atomic for insertion as well as deletion, and the second half was missing** (REM-313). A caret
  resting *inside* `[Image #1]` was handed straight to `insertAt`, which cut the token in half:
  `[Imag [Image #2] e #1]`. The halves are literal text, so the diff path below read reference 1 as
  lost and dropped the attachment it stood for — pasting one picture silently removed another, and
  left garbage in the words the person typed. `caretOutside` in `shared/references.ts` snaps the
  caret to the nearer edge of the token first; a tie goes after it. It sits in `useComposer`, the one
  thing holding the caret, so every insertion path — paste, drop, an element comment, an asset pick,
  a written phrase — is closed by one call each rather than by five separate rules.
- **The binding runs both ways, which is why the reference is atomic.** Deleting the
  reference deletes the attachment, so Backspace/Delete touching or inside `[Image #N]`
  takes the whole token in one keystroke rather than leaving `[Image #1`, which parses as
  nothing. Anything that removes a reference wholesale — select and delete, cut, paste
  over, Cmd+A — is caught instead by diffing the draft against the previous one in
  `onChange`, and that path is the *only* one that rewrites text the user just typed, so
  the fast path must never touch the caret. Two consequences worth knowing: modified
  deletes (Option/Cmd+Backspace) are left to the browser and land in the diff path, and
  **this reverses #13's story 16** — referencing is no longer optional, so an attachment
  cannot outlive its reference. `contentOf`'s unreferenced-first rule stays because it is
  what keeps a no-reference message byte-for-byte what it was, not because the UI can
  still produce one.
- **The composer owns the text, so it owns the references.** `useAttachments` is a plain
  store whose add/attach report *how many* items arrived; every operation that touches
  both the list and the text is orchestrated in `useComposer`, the only thing holding the
  caret. `refer()` reads the live textarea rather than the `value` closure, so an image
  that took a second to save cannot overwrite what was typed meanwhile.
- **Three rules keep the spliced content safe.** Attachments nobody referenced go **first**,
  ahead of the whole sequence — with no references at all that reduces byte-for-byte to
  what the builder emitted before, which is what keeps the old behaviour and its tests
  intact. A repeated reference stays literal text, so the image is sent once. Empty and
  whitespace-only text blocks are dropped, because the API rejects them. The reference
  text itself is *not* kept in the content — the image is at that spot — while the stored
  transcript keeps the raw prompt, so history still shows `[Image #1]`.
- **Pasted bytes become a file before anything else touches them.** The contract carries
  attachments as paths, so the one unavoidable crossing happens once, at paste time, as a
  **raw-body invoke** — bytes as a binary body, not a JSON array of numbers — with the media
  type and the percent-encoded filename in request headers. `src-tauri/src/paste.rs`
  decides where the file lives, exactly as the core decides where the history database
  lives; the webview never picks a location. The written name is sanitised, keeps the
  original extension when it already implies the same media type, and is disambiguated on
  collision, so the basename is what the card displays. **Pasted files are never swept**:
  history renders the same previews for past turns, so a sweep would hollow out old
  sessions.
- **Colouring a `<textarea>` is an overlay, not a rich editor.** The composer stays a real
  textarea — keyboard behaviour, accessibility and the existing tests depend on it — with
  its own text transparent, its caret kept, and a mirrored `aria-hidden` layer underneath
  carrying identical typography and padding. `MessageText` draws both that overlay and the
  user's bubble in the transcript, so a sent message looks like the message that was
  written. The colour is its own token (`--reference`), not the primary colour, which in
  the dark palette is too dark to read as text.
  - **A reference may differ in colour and in nothing else.** The caret is positioned by
    the textarea's metrics and the text you read is the overlay's, so any per-reference
    style that changes width — weight, tracking, size, family, padding — desyncs the two,
    and the error *accumulates*: `font-medium` on the span put the caret a character off
    after four references. Colour is the only property that costs nothing here.
- **The colour picker opens on a real click, not a scripted one.** dialkit 1.4.3 hid its
  `<input type="color">` at zero size with `pointer-events: none` and asked the swatch to
  `.click()` it — which WebKit ignores, so the swatch did nothing at all here, and
  `app/globals.css` put the input back over the swatch: invisible, but the thing the
  pointer actually landed on. 2.0 replaced that input with a popover opened from a real
  `<button>`, so the rule went with it — the three classes it named no longer exist.
- **Previews come from the asset protocol**, enabled in `tauri.conf.json` with the
  `protocol-asset` cargo feature; no ACL permission is involved, since Tauri 2 gates it by
  configuration alone. The scope is `**` on purpose: an attachment can be picked from
  anywhere and the app already opens arbitrary folders. `previewUrl` returns `null` rather
  than throwing outside a Tauri webview, and a dead path falls back to the icon the card
  used to show. **The card is the picture and nothing else** — a filename and a format chip
  are what you read when you cannot see which one it is, so showing the thing itself
  replaces them rather than joining them. The name stays as the image's `alt` and the
  card's hover title, which is also all that identifies a card whose file has gone.
- **Under happy-dom there is no asset protocol either**, so a test that renders a non-empty
  attachment list installs the `convertFileSrc` fake next to the command fake — per test,
  because `clearMocks()` drops `window.__TAURI_INTERNALS__` between them.

Whether the macOS webview actually hands a pasted image to the page is the one thing no
seam can test; it is verified by hand in the running app. If it ever stops doing so, the
fallback is to read the clipboard in the core: the command loses its request body and
everything above it is unchanged.
