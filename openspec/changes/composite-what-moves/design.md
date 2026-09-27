## Context

`preview/frame-clips.ts` marks every element in the player whose box matches the
frame and whose overflow clips, and a stylesheet in the runtime's shadow root
sets `overflow: visible !important` on the marked elements. That is how the
canvas draws content outside the frame. The stage — the frame-sized,
camera-transformed `div` in `CanvasStage` — clips only in hide mode (REM-531);
around it, `CanvasSurround` draws four rectangles, translucent in dim mode.

The superseded proposal (`frame-only-while-playing`, this directory's earlier
content) clipped the stage while the video played. It measured well but made dim
mode frame-only during playback, which is rejected. This design records the
exploration that replaced it.

## Harness

WebKit (Playwright's build 2336, Safari 26.5 user agent — the engine of the
app's WKWebView) around the studio's real native runtime, development build as
the preview host serves it, bundling `remocn-studio-v2-videos/src/videos/remocn-walk`
(1920×1080, 30 fps) and mounted the way `lib/studio/native-preview.ts` mounts
it: a shadow host in a 1920×1080 stage under a scale transform, in a 1100×700
page, no chrome. "bare" is `@remotion/player` alone on the same stage. Unless a
row says otherwise, a run is the September scene (frames 262 onwards, 2.7 s),
variants interleaved (1, 2, 3, … then again), medians of displayed frames per
second / rAF gaps over 50 ms ("stalls"). Other agents were building on the same
fanless MacBook; the load average before → after is given per run, and only
comparisons within a run carry.

Variants: **lifted** — the runtime before this change; **clip** — the stage
`overflow: clip` (hide mode); **composited** — this change.

## Where the cost is

Probing the page at 30% zoom, frame 300:

- Each September row is a strip of type `width: max-content` — 1273 screen px
  wide at 30% against a 576 px frame — moved by `transform: translateX(…)`
  every frame. Every third row carries `filter: url(#outline)` (an SVG
  `feMorphology` outline). Each row's wrapper has `clip-path: inset(…)` to its
  own frame-wide box, so what the canvas shows beyond the frame is only the row
  above and the row below it — a thin band, not the strips' full width.
- `overflow-clip-margin` is not supported (`CSS.supports` false, computed value
  empty); `overflow: clip` is.

Run E, 30%, 5 reps (load 3.40 → 4.98):

| variant | fps / stalls |
|---|---|
| bare | 21.2 / 0 |
| lifted | 15.0 / 31 |
| clip | 23.8 / 1 |
| lifted, stage `clip-path` inset to the visible viewport | 13.5 / 29 |
| lifted, stage `clip-path: inset(0)` | 15.7 / 33 |
| lifted, outline filter removed from the scene | 29.5 / 0 |
| clip, outline filter removed | 29.6 / 0 |
| bare, outline filter removed | 27.2 / 0 |

Reading it: the whole gap is the SVG filter re-run over each moved strip. Without
it, lifted equals clip at a full 30 fps. The only thing that bounds the filter
is an `overflow` clip in the strip's own transformed space — the frame-sized
clip the canvas lifts, or the stage's own `overflow: clip`. A `clip-path` does
not bound it, even `inset(0)`, and neither does the viewport's `overflow:
hidden` outside the stage's scale transform. The row's own `clip-path`, which
hides most of what gets filtered, does not bound it either.

## Candidates

### 1. Bound the paint area — rejected

`overflow-clip-margin` does not exist here and `clip-path` does not bound the
work (run E). What remains is an inner `overflow: clip` box inside the stage,
sized to the part of the viewport the camera shows, with the shadow host offset
inside it. Run F (load 3.78 → 8.98, 5 reps):

| variant | 30% | 50% |
|---|---|---|
| bare | 21.7 / 1 | 21.2 / 5 |
| lifted | 14.2 / 30 | 15.7 / 26 |
| clip | 20.0 / 8 | 20.3 / 2 |
| inner clip at the frame | 23.1 / 3 | — |
| inner clip at the visible viewport | 14.0 / 30 | 20.3 / 14 |

The inner clip is as good as the stage clip when frame-sized, so the mechanism
works; at the visible viewport it helps at 50%, where the strips run far past the
viewport, and not at all at 30%, where the viewport shows almost their whole
width. It would also have to follow every pan and zoom in step with the stage
transform, and trimming it to the unoccluded area only pays under the opaque
inspector. Not worth it once candidate 3 lands.

### 2. Two rates (a frozen or slower surround) — rejected, not built

WebKit has no `element()` paint source, so a cheap copy of the surround means a
DOM clone of the video (canvases and WebGL do not clone, media would reload,
duplicate ids break `url(#…)` references) or a native WKWebView snapshot over
IPC before every play and after every camera move. Either way the person sees
the surround stand still while the frame moves — rows that should slide across
the frame edge break there — and refreshing it every N frames is one full
lifted paint every N frames, a stall on a schedule. Candidate 3 removes the cost
without showing anything that is not the video.

### 3. Composite what moves — chosen

Run G, 30%, 5 reps, measured under heavy load (12.04 → 13.60), so read across
the rows:

| variant | fps / stalls |
|---|---|
| bare | 18.2 / 31 |
| lifted | 13.5 / 29 |
| clip | 20.9 / 7 |
| lifted, `will-change: transform` on the strips (scene edit) | 28.1 / 1 |
| clip, same | 28.4 / 1 |
| bare, same | 26.3 / 2 |
| lifted, `will-change: transform` on the lifted containers | 13.1 / 27 |
| lifted, `will-change: transform` on the stage | 10.7 / 23 |
| lifted, dim rectangles drawn over the surround | 12.5 / 27 |

A composited strip is rasterised with its filter once and slid by the
compositor, so it costs the same lifted or clipped, and less than the bare
Player. Compositing the containers or the whole stage does not help — the strip
still repaints inside the bigger layer — and the stage case is worse. The dim
rectangles cost nothing measurable.

The runtime cannot edit the scene, so it has to find what moves. Run H, 30%, 5
reps (8.86 → 8.45):

| variant | fps / stalls |
|---|---|
| bare | 15.4 / 31 |
| lifted | 11.3 / 24 |
| clip | 19.3 / 25 |
| lifted, promote an element when its inline transform changes | 26.5 / 3 |
| clip, same | 27.3 / 3 |
| lifted, CSS: every element with an inline `transform:` | 27.7 / 1 |

Both runtime forms work. The CSS form also composites every static transform —
the `translate(-50%, -50%)` of every centred element — for no gain and a layer
each; the observer composites only what actually moves. Over a full playthrough
the observer marked at most 30 elements at once (the name scene's glyphs), 13 in
September, one elsewhere. Its first cut also marked the Player's own scaled
container, which changes its transform once on mount, putting the whole video in
one layer — the stage-sized case that measured worse; the Player element is
excluded.

### Full video, 30%, two passes each (load 3.25 → 3.67)

Per-scene fps / stalls, pass 1 then pass 2:

| scene | bare | lifted | clip | composited (observer) |
|---|---|---|---|---|
| overall fps | 28.9, 29.2 | 27.9, 27.9 | 28.8, 29.3 | 29.6, 29.6 |
| September | 19.8/1, 25.2/0 | 14.8/34, 15.0/35 | 20.0/0, 25.4/0 | 28.0/3, 28.0/3 |
| Type | 28.7/4, 28.5/4 | 24.7/11, 24.9/11 | 27.4/5, 28.3/3 | 28.7/3, 28.7/3 |
| Bauhaus | 29.9/0, 29.9/0 | 29.5/2, 29.5/2 | 30.0/0, 29.9/0 | 30.0/0, 30.0/0 |
| name, paste, grid, accents, signature | 29.0–30.1, no stalls | 29.4–30.2, ≤1 | 29.9–30.0, 0 | 29.9–30.0, ≤1 |

No scene gets slower; the Type scene, which was inconclusive before, improves
as well.

### The change as built

Runs I–K build `preview/frame-clips.ts` from this change ("composited") and
from it with the observer removed ("lifted"), 6 reps for September, 5 for Type:

| run | bare | lifted | lifted + clip | composited | composited + clip | composited + dim rectangles |
|---|---|---|---|---|---|---|
| I, September 50% (3.19 → 3.54) | 25.1 / 1 | 21.9 / 0 | 26.9 / 0 | **28.4 / 1** | 29.1 / 1 | 28.4 / 1 |
| J, September 30% (3.54 → 2.45) | 23.4 / 0 | 16.0 / 34 | 25.4 / 0 | **28.0 / 4** | 28.8 / 1 | 28.0 / 4 |
| K, Type 50%, 4 s from 675 (1.98 → 1.81) | 27.1 / 2 | 27.7 / 6 | 28.6 / 2 | **28.4 / 4** | — | — |

With content outside shown, the canvas now plays September faster than the bare
Player at both zooms, within about one frame per second of the clipped stage.
The few stalls left at 30% are the frames before a strip is marked — the first
change of its transform still repaints.

Screenshots of thirteen paused frames across the video, lifted against
composited, are pixel-identical (zero pixels differ by more than 16 of 255,
maximum delta 0). Playwright's WebKit screenshot repaints the page in software,
so this proves the layout, stacking and clipping are unchanged, not how the
compositor rasterises the layers; that is for the running app (tasks 2.3).

## Decisions

### The runtime composites an element while its transform moves

In `releaseFrameClips`, next to the lift, a `MutationObserver` on the video's
root with `attributeFilter: ["style"]` and `subtree`. For each record whose
target is an `HTMLElement` strictly inside the player:

- it remembers the element's inline `transform` in a `WeakMap`;
- if the transform is empty or `none`, it removes the marker;
- if the transform differs from the last one seen, and the element is not laid
  out inline (a transform does not apply to an inline box, and the hint would
  still form a stacking context there), it sets `data-remocn-moving`;
- the lift's stylesheet gives `[data-remocn-moving]` `will-change: transform`.

The marker only ever sits on an element with a non-`none` transform, which
already forms a stacking context and a containing block, so it changes how the
element is drawn — its own layer — and nothing about layout, stacking or
picking. It lives in `frame-clips.ts` because the lift is what makes moving
content expensive, the two share the stylesheet and the lifecycle, and a new
file would need its own `tauri.conf.json` resource.

It does not depend on dim or hide mode: with the stage clipped it still saves
the repaint (composited + clip above), and the runtime does not know the mode.

### State and failure direction

All state is the runtime's, in the video's shadow root: the marker attribute and
a `WeakMap` that dies with the elements. Nothing crosses the wire; no protocol
bump, migration or `settings.json` key.

If the observer misses an element, it repaints as before — slower, never wrong.
If WebKit refuses a layer (memory pressure), `will-change` is only a hint and
the element paints as before. A composited element could look softer while its
own scale animates, because WebKit may keep its raster scale for a frame; the
change leaves content whose pixels change every frame repainting as before.
Releasing the runtime disconnects the observer and removes the stylesheet, so
the markers stop meaning anything.

The marker shows in the markup a selection carries, as `data-remocn-frame-clip`
already does; stripping runtime attributes there is left for later.
