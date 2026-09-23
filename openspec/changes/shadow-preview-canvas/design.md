## Context and authorization

The user requested full adaptation in the main application after the isolated
lab. Main Studio now selects the canvas host by default. The earlier requirement
to evaluate the lab before promotion is superseded by that explicit request.
The user retains runtime verification; no checks are authorized.

## Runtime boundary

A connection-owned surface channel routes the existing decoded commands and
events. The active connection alone can update the app. The native surface is its
only adapter (see *One preview host*).

The project compiler produces a distinct window library exporting mount/dispose.
It uses project React, ReactDOM, Remotion and loaders, preserves sequence source
traces, and omits page renderEntry, environment/React shims and Fast Refresh.
Project components never enter the app's React tree. A single runtime owns the
window; its disposal unmounts React, releases media/styles, subscriptions and
owned globals. Hook-based render delays use a runtime-owned scope; late external
continueRender calls are ignored after disposal. Rebuilds replace only this runtime and emit the existing rebuilt
message. Playback positions and camera state survive the replacement.

Player, transport, inspection, snapshot and tuning live in the native runtime. The bridge accepts injected local delivery. Events from that
bridge are queued until mount effects finish, matching asynchronous page messages.
The direct channel still uses object generation, operation and request IDs.

## Rebuilds swap without a gap

A rebuild used to dispose the runtime on screen, fetch and mount the next one,
and show "Preparing the canvas…" over an empty frame in between. The canvas now
double-buffers. A window-level session owns the Remotion globals; each runtime
is a slot with its own host, ShadowRoot, overlay layer and script. The next slot
mounts hidden and inert, paused at the current slot's frame with its volume and
mute, and its messages are buffered rather than delivered. The runtime reports
`native.painted` once the Player has mounted and its render delays have cleared
(capped at 3 s), or at once when the video cannot play. Only then, in one task,
the old slot is disposed, the new one is shown, attached to the channel,
announces `rebuilt`, flushes its buffered messages and resumes playback.

Rebuild announcements are a sliding stream switched to the latest: a rebuild
during staging discards the staged slot. An EventSource reconnect re-checks the
manifest, and a generation already on screen is not restaged. A staged slot
that fails to load, throws or does not draw within 30 s is dropped; the shown
slot stays and the state carries a stale notice.

A painted slot is also held back while the shown one is being edited or would
be undone by it. The camera lock (`data-preview-editing`, set by geometry and
inline text from pointer-down until commit settles) holds the swap for the whole
gesture, since disposing the runtime mid-drag dropped the gesture and snapped the
element back to its source position. The staged slot's buffered `studio.ready`
carries its objects document's last operation; `useManagedObjects` accepts it
only when no gesture, write or undo is in flight and that operation is not
behind the last one the studio wrote. Otherwise a following rebuild must bring
the write; switching to the latest discards the lagging slot. A lag without such
a rebuild is released after 8 s; an edit lock is not. The loading screen belongs to
the first mount only. Compile failures of the render bundle still surface as the
preview's failure, as before.

## Managed runtime compatibility

The supported studio-objects-v5 provider skips messaging outside an iframe.
A narrowly scoped pre-loader adapts its known transport calls to the injected
bridge while keeping document validation, drafts, generation and operation IDs.
An unexpected provider transport fails compilation explicitly. The loader is
native-only; neither authored videos nor rendering/export output are rewritten.

## DOM and camera

Surface configuration supplies the ShadowRoot, viewport, overlay layer, source
resolver and absolute asset base. Queries and hit tests stay within the content
root. Composed event paths recover the actual clicked element. Ancestor traversal
crosses the host to account for the camera's scale during geometry operations.

Selection boxes, geometry handles, text editing and snapshot marquees occupy an
unscaled, clipped layer. They retain client coordinates and constant screen hit
targets. Normalized annotation rectangles are relative to the video and mapped
through the app camera. View changes repaint overlays even when playback pauses.

Navigation capture precedes scene interaction. Geometry, inline text and snapshot
drags lock camera movement. Properties and playback chrome do not trigger picks
or navigation. Space-drag, middle drag, the hand tool and wheel pan navigate;
Ctrl/Meta-wheel zooms beneath the pointer. K plays. The bounded camera is remembered
per project/composition/dimensions, independently of edits and Undo.

## Main shell

The inspector is visible by default, flush with the top/right workspace edges.
It shows video information without a selection and the existing PropsPane for a
tunable selection. Its toolbar owns the Snapshot icon, Export and visibility
control; hiding it preserves selection.
It does not change the pane's size or automatically reframe the video. Explicit
Fit includes overlay insets. Playback, status and export feedback stay fixed.
Docs hides the mounted runtime; fullscreen contains
the canvas and its controls. Settings no longer requires navigating into a lab.

## Styles and assets

A style-loader insertion module targets the ShadowRoot. Common html/body/:root
selectors map to :host. CSS font faces are registered with owned FontFace objects
and removed on disposal. Player CSS uses the same destination. The Remotion
facade makes staticFile URLs absolute; imported webpack assets use a dedicated
publicPath. Native script and source map addresses point to the preview host.
Source resolution uses Grab's stack API without initializing its global UI.

## Remaining compatibility boundaries

Shadow DOM shares JavaScript globals, rem units, viewport units and media queries
with the editor. Arbitrary project portals, global side effects and bare relative
URLs need project-specific adaptation. Extracted CSS configurations are explicitly
rejected. One main chunk avoids stale lazy composition modules; custom workers
and unusual webpack overrides remain runtime evaluation cases.

## Delivery and verification

Native sources and the compatibility loader are included in desktop resources.
The sidecar must be restarted for its new endpoints/compiler to take effect.
The app/preview implementation is complete in source; runtime behavior, visual
parity, all five videos and packaged operation have not been verified. See
app/lab/preview-canvas/README.md for user-facing operation notes.

## One preview host

The canvas is the only preview. The iframe host, its presentation switch and the
separate properties column are gone; `PreviewControl` always carries
`attachSurface` and `focus`. The sidecar no longer serves a preview page at `/`
and the main bundle's entry is the render entry alone, so that bundle is only
what the renderer, Snapshot and the design check load. Compile progress, which
only the page used to show, is on the canvas. Fit reads the rectangles of the
elements marked `data-canvas-occludes` (header and toolbar on top, inspector on
the right, playback at the bottom) rather than constants, so hiding the inspector
or a taller dock changes what Fit leaves free.

## Shared workspace spacing

Chat, playback and inspector instruction docks use a shared 16px outer inset,
128px minimum surface height, field background, quiet border and common radius.
The minimum grows with content instead of clipping it. Action rows sit at the
bottom; playback hints sit above its action row. Instruction inputs use the same
InputGroup treatment as the chat composer rather than a separately bordered
textarea plus detached button. Inspector fields and headers share the 16px edge.
The canvas Fit inset reserves space for the common footer height. Runtime and
visual checks remain deferred to the user.
