# Entry, emphasis, exit

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`library/components-and-roles`](../../openspec/specs/library/components-and-roles/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Keyframes are replaced by a vocabulary of named behaviours, and the vocabulary has a
skeleton: every movement belongs to one moment in the life of the thing it is attached
to (REM-290). `role: entry | emphasis | exit | scene | transition` is that axis — one
field, one value — where the pane's categories (Typography, Shaders, Filters…) answer
*what a component is about* and the role answers *when it runs*.

- **`shared/motion.ts` is the taxonomy, and the prompt is generated from it.** The
  roles, their one-line hints, the props each role expects and the twenty dictionary
  names live there; `MOTION_TAXONOMY` in `sidecar/claude/conventions.ts` composes the
  always-on paragraph out of those values, so the words the agent is given and the
  words the person reads cannot drift. A test pins that every dictionary name is
  documented in the `motion-design` skill — names in the convention, recipes in the
  skill, which is the split #290 proposed.
- **The roles of the shipped set are ours, not upstream's.** They live in
  `sidecar/library/roles.ts` rather than in the vendored manifests, because `remocn/`
  is hash-locked against a pin and `remocn:check` reads any edit there as drift — the
  classification is editorial judgement, and writing it into that tree would make every
  future `remocn:sync` a merge. A test fails when `remocn/index.json` ships a component
  nothing has classified, so a sync that adds components cannot land unclassified ones.
- **One rule settles the hard cases.** A behaviour that replaces an element's content in
  place — a value swap, a per-word crossfade, a strikethrough that reveals the new line
  — is `emphasis`: the element was there before and is there after. A behaviour that
  brings content out of nothing is `entry`, and so is a number that counts to the value
  it lands on, because the count is how that value arrives.
- **`scene` and `transition` are on the same axis, not a second one.** They are the two
  answers that are about a whole scene rather than one element, and ambiguity resolves
  outward: transition over scene over the three element roles. A component has one home,
  because the pane groups by exactly one thing.
- **The dictionary obeys `video-lessons`.** `pulse` is not in it — §1 bans pulsing — and
  `rise-in` is documented as panels-and-images only, because a text entrance travels on
  X or the glyph baselines snap (§2). A dictionary that contradicted the lessons would
  be a vocabulary for producing the exact failures the lessons record.
- **The role heading is above the tiles, not merely opaque** (REM-325). It always had the
  pane's own `bg-sidebar`; what it lacked was a layer. At `z-0` it lost to a tile's own
  positioned children — the `Attachment` trigger is `absolute inset-0 z-10` and its actions
  `z-20` — so a row scrolling under it printed straight through the word, and the only
  thing saying which role you are looking at went illegible exactly while scrolling 99
  components. `z-30` clears both. Making it visible then showed the other half: the
  heading stuck at a flat `top-11` while the search field above it is 44px only until
  `sm:`, where the input drops to `h-7.5` and the field becomes 40px — so tiles scrolled
  through a 4px band between the two.
- **Nothing interactive is `sticky` inside the pane's scroller** — that is what finally
  made the search field answer. Raising it to `z-40` changed nothing: WKWebView draws a
  stuck element at the top and hit-tests it where it was *laid out*, so once the grid had
  scrolled the field looked right and a click went to the tile underneath. `PaneScreen`
  in `components/studio/pane-screen.tsx` is the one shape every view has now — a pinned
  block above the `SidebarContent` scroller, the list inside it — and the search fields
  of Assets, Components and Stock, the scope switch and *New video* all live in the
  pinned half. The offset above and `UNDER_SEARCH_FIELD` went with it: the role headings
  stick to the scroller's own `top-0`, which is also why the Components view turns the
  scroll fade off — the fade is a mask over the viewport's top 1.5rem, exactly where a
  stuck heading sits. A test per pane pins that the field is outside the viewport.
- **The pane groups by role.** Entry, Emphasis, Exit, Scene, Transition with a count
  each; category survives in the data and orders the tiles *inside* a group, so Scene
  reads shaders before filters. A saved component sits in its own role beside the
  shipped ones — the dictionary growing is the point — and the ones saved before roles
  existed keep a leading *Saved* group. The delete action moved from the grid to the
  tile (`isBundledSlug`), since one group now holds both kinds.
- **What the shipped set actually is, measured through `library.bundled`:** 99
  components, none unclassified — 21 entry, 15 emphasis, 4 exit, 36 scene, 23
  transition. Exit being that thin is information, and it is visible now.
- **Nothing without a role behaves differently.** The field is nullable everywhere it is
  stored, decodes to `null` for a manifest written before it existed, and `save_asset`
  takes it as an optional argument — media has no role and is not given one. The role
  travels into the turn on the `[Asset #N]` block as `(entry)` after the name.
