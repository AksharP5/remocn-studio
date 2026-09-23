> Implementation update: the user subsequently requested full integration in
> the main app. The native canvas is now the default shell surface; editing,
> Snapshot and the real inspector share the existing runtime and operation
> hooks. Earlier lab-only observations below record the initial research phase,
> not the current rollout gate. No runtime verification has been performed.
> Current behavior and boundaries: app/lab/preview-canvas/README.md.

# Preview as a navigable canvas

Research and proposal, 2026-09-22. Based on source inspection; no application,
tests, builds, or browser checks were run. This document does not change the
current preview or establish that the proposed embedded runtime is compatible
with every existing project.

## Intended experience

The workspace contains a finite video artboard inside a navigable canvas. Pan
and zoom change the editor's view. The composition's dimensions, geometry,
animation, and exported pixels remain controlled by the existing video model.

The inspector sits above the canvas at the right edge. Opening it does not
resize the artboard or change the camera. Playback controls and zoom controls
also occupy an unscaled overlay layer. Fit explicitly frames the video inside
the unobscured part of the workspace. Empty selection can show composition
information in the same inspector location.

Start with the existing sidebar and chat boundaries. Their redesign is not
required to replace the current preview/properties columns with one workspace.

## What Diffusion Studio actually does

Source inspected at commit
[`57c39834bb3d2f116ce1d2c76cc8b881a279c2e6`](https://github.com/diffusionstudio/editor/tree/57c39834bb3d2f116ce1d2c76cc8b881a279c2e6).

- [CameraController](https://github.com/diffusionstudio/editor/blob/57c39834bb3d2f116ce1d2c76cc8b881a279c2e6/apps/web/src/engine/camera-controller.tsx)
  handles wheel pan, Ctrl/Meta-wheel and pinch zoom, Space/hand-tool drag, and
  middle-button drag. Zoom is anchored beneath the pointer; pointer capture
  keeps a pan continuous.
- [Camera actions](https://github.com/diffusionstudio/editor/blob/57c39834bb3d2f116ce1d2c76cc8b881a279c2e6/packages/runtime/src/actions/camera.ts)
  separate input handling from camera mathematics. Camera queries provide
  screen-to-document and document-to-screen conversions. Fit and selection
  framing share this model.
- [EngineCanvas](https://github.com/diffusionstudio/editor/blob/57c39834bb3d2f116ce1d2c76cc8b881a279c2e6/apps/web/src/engine/canvas.tsx)
  mounts their engine on an HTML canvas. Their runtime uses its own scene model
  and renderer; it is not a replacement container for arbitrary Remotion JSX.
- The [main editor layout](https://github.com/diffusionstudio/editor/blob/57c39834bb3d2f116ce1d2c76cc8b881a279c2e6/apps/web/src/pages/editor.tsx)
  still allocates grid columns to its main inspector and sidebar. A separate
  [FloatingInspector](https://github.com/diffusionstudio/editor/blob/57c39834bb3d2f116ce1d2c76cc8b881a279c2e6/apps/web/src/components/ui/floating-inspector.tsx)
  supports draggable popovers. Our proposed always-over-canvas inspector is a
  product decision, not an exact copy of their main layout.
- Their camera actions report camera changes back to the project document.
  For Remocn, store navigation state per project/composition as editor state,
  separate from video property operations and their Undo history.

The useful reference is the camera/input/layer separation. Reusing their
runtime would mean converting our existing React/HTML/CSS compositions into a
different scene model.

## Current integration points

| Area | Current implementation | Canvas work |
| --- | --- | --- |
| Workspace | `components/studio/app-shell.tsx`: chat, preview, and properties are resizable siblings | Keep chat separate; place properties above the preview workspace |
| Frame layout | `components/studio/preview-controls.tsx`: aspect-ratio wrapper fitted to the pane | Full workspace viewport, camera, artboard, fixed controls |
| Preview loading | `components/studio/preview-pane.tsx`: iframe loaded from the project server | Introduce a surface interface with explicit mount/dispose ownership |
| Rendering | `preview/entry.tsx`: project's React and Remotion mount a Player | Preserve composition discovery, metadata, frame, media, and interactivity |
| Picking | `preview/inspect.ts`, `preview/picker.ts`: document-wide queries and pointer listeners | Scope queries, events, and hit testing to the preview surface |
| Handles | `preview/geometry.ts`, `preview/geometry-target.ts`: DOM bounds, ancestor scale/rotation, body overlays | Include camera scale once; paint handles in screen coordinates |
| Text entry | `preview/inline-text.ts`: body textarea positioned over measured text | Keep editor and text aligned through camera changes and shadow boundaries |
| App annotations | `components/studio/inspect-overlay.tsx`: normalized viewport rectangles | Refresh positions when the camera changes, including saved markers |
| Snapshot | `preview/snapshot.ts`: crop normalized against video bounds | Convert workspace gestures back to composition coordinates |
| Updates | `preview/hot.ts`: project EventSource and page reload fallback | Dispose/remount only the preview on an unrecoverable update |
| Packaging | `src-tauri/tauri.conf.json`: explicit preview source resources | Include any new runtime modules in desktop resources |

## Can the iframe be removed?

Yes in principle: [Remotion Player](https://www.remotion.dev/docs/player/player)
accepts a React component and does not require an iframe. Our iframe currently
hosts a separately compiled project with its own dependencies, globals, CSS,
asset paths, and hot reload lifecycle. Replacing that hosting contract is the
substantial part of removing it.

| Approach | Benefit | Cost / limitation |
| --- | --- | --- |
| Full-workspace iframe, camera inside it | Preserves the project runtime and most existing DOM editing machinery | Commands and screen-space overlays still cross the document boundary |
| Separate project React root inside Shadow DOM | Video and editor share one workspace document; CSS can be scoped to the project | Requires a new runtime entry, stylesheet routing, scoped picking, and explicit cleanup; JavaScript globals still share the window |
| Import project components into the app's React tree | Simple for a fixed, controlled composition | The app would need to resolve the opened project's versions, bundler overrides, and CSS rather than simply receiving a runtime |
| Replace rendering with Canvas/WebGL scene objects | Native scene-graph editing | Existing Remotion JSX, CSS layout, and source bindings require a major migration |

For the requested iframe-free direction, the candidate is **a project-owned
React root inside an open Shadow DOM**, exposed through a small runtime adapter.
React supports [multiple roots](https://react.dev/reference/react-dom/client/createRoot).
Keep the project's renderer and component together; exchange commands and data
with the app instead of passing project React components across version boundaries.
[Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
provides DOM/CSS encapsulation, not a separate JavaScript environment.

### Specific work needed for Shadow DOM

1. Export an explicit runtime entry such as `mount(surface, options)` returning
   a session with `send`, event subscription, and `dispose`. Today the bundle
   initializes a whole page and finds a hard-coded document container.
2. Retain the project's Remotion bundler and overrides. Direct CSS injection
   into the shadow root needs a loader strategy compatible with the project's
   Tailwind/CSS setup. Document selectors (`html`, `body`, `:root`), font loading,
   inherited properties, and CSS variables need deliberate handling.
3. Supply project asset/public paths and a project-specific hot reload URL.
   Today `new EventSource('/__remocn/hot')` resolves against the iframe origin;
   it would resolve against the app if moved unchanged. Recoverable updates
   preserve the frame; fallback remounts the surface, never the app window.
4. Replace `window.parent.postMessage` with a transport adapter using the
   existing command/event vocabulary. Keep the iframe transport available
   during migration so the same behavior can be exercised through either host.
5. Pass a surface root and overlay root into editing code. Use shadow-aware hit
   testing and event paths: document-level events may expose the shadow host
   as their target. Ancestor transform traversal must cross the host boundary
   where necessary. A document-wide selector no longer finds project nodes.
6. Own cleanup of roots, listeners, observers, style tags, media, and update
   subscriptions. A removed iframe previously performed much of this cleanup.
   Audit Remotion/browser globals and bundled hot-refresh hooks across project
   switches; a React unmount alone is insufficient.

These are compatibility questions for a prototype with real project output.
The source review establishes a plausible path, not a drop-in replacement.

## Camera and overlay model

Use a single camera `{ x, y, zoom }`, with translation measured in workspace CSS
pixels and zoom measured against composition pixels. Keep composition dimensions
fixed. For an unrotated viewport:

```text
screen = origin + cameraOffset + compositionPoint * zoom
compositionPoint = (screen - origin - cameraOffset) / zoom
```

On zoom, invert the pointer position with the old camera, then choose the new
offset so the same composition point stays beneath the pointer. Device pixel
ratio is not another factor in DOM pointer coordinates.

The visual layers should be:

```text
Workspace viewport
  Artboard content, transformed by the camera
    Project composition rendered by Remotion
  Selection outlines, handles, dimensions, text editor
  Inspector, playback strip, zoom controls, status
```

Handles keep a constant screen-space hit target. Dimension labels show
composition units. If the iframe host is retained initially, keep its element
unscaled and make it fill the workspace; transform the artboard inside it.
Scaling the entire iframe would also scale its internal handles and inputs.

Fit uses the visible rectangle excluding inspector and playback overlays.
Opening a panel must not silently re-fit a manually positioned camera. Preserve
the user's view while switching selections. Initial Fit and explicit Fit may
recenter; 100% means one composition pixel per CSS pixel.

## Input ownership

- Trackpad scroll pans; pinch or Ctrl/Meta-wheel zooms beneath the pointer.
- Hand tool, middle button, and Space-drag pan. Dragging a selected object keeps
  editing its geometry when the hand gesture is not armed.
- The original Space shortcut plays immediately. The first lab reserves Space
  for navigation and uses K for playback. Tap-Space playback on release could
  be evaluated later, with a drag consuming the tap. Text inputs and buttons
  keep their normal keyboard behavior.
- While a geometry gesture is active, defer camera gestures. This avoids changing
  its coordinate system halfway through a resize. Text input should retain its
  own scroll behavior and have an explicit policy for navigation shortcuts.
- Inspector wheel/drag events belong to the inspector. Canvas listeners must
  not intercept panel interactions.
- Camera updates repaint selection and markers; a CSS transform alone does not
  trigger the existing geometry attribute observer or a window resize event.

## Proposed sequence

1. **Define the surface boundary.** Extract mount/commands/events/dispose and
   explicit surface roots from iframe assumptions. Preserve current editing
   behavior and the project's build pipeline.
2. **Build an isolated iframe-free prototype.** Load an existing composition
   with real generated CSS, fonts, media, and managed objects into Shadow DOM.
   Include project switching and a preview-only remount path. This resolves the
   main unknown: whether its rendered output and lifecycle remain compatible.
3. **Add the canvas interaction model to that surface.** Pan, pointer-anchored
   zoom, Fit, 100%, zoom to selection, fixed-size handles, and a floating
   inspector. Keep playback controls in the fixed overlay layer.
4. **Connect all existing interactions.** Geometry, inline text, annotations,
   Snapshot, fullscreen, Docs switching, hot updates, save receipts, and Undo
   must use the same camera/surface contract. Navigation remains separate from
   video writes and export.
5. **Promote after user evaluation.** Restore camera per project/composition and
   use the new workspace as the normal preview. Existing videos should not need
   another geometry migration just to gain canvas navigation.

An iframe-based full-workspace canvas remains an alternative if the embedded
runtime's project compatibility proves too costly. Both hosts can use the same
workspace design and camera behavior.

Multiple simultaneous artboards, adding/deleting/duplicating objects, grouping,
snapping, and keyframe creation remain subsequent features. None is required
to deliver the navigable canvas and fixed inspector requested here.

## Deeper findings and first implementation

An isolated implementation now lives at `/lab/preview-canvas`; the default
Studio keeps its iframe. This is source-level implementation, not evidence of
successful runtime verification. No tests, builds or browser checks were run.

| Finding in installed source | Implementation / remaining consequence |
| --- | --- |
| Player calls `Internals.CSSUtils.injectCSS`, not only renderEntry | The native Remotion facade redirects Player styles to the shadow root; simply omitting renderEntry was insufficient |
| `staticFile()` prepends `/` to its result | The facade wraps project validation/encoding and adds the absolute preview asset origin; assigning an absolute global static base would produce a broken `/http…` URL |
| style-loader accepts an insertion module path | A native insertion module queues styles before mounting and then inserts them into the supplied root; loader functions cannot assume all installed versions accept a serialized function |
| Project webpack plugins can own mutable compiler state | Native compilation requests a fresh configuration and plugin instances, with a separate output directory per project |
| v5's provider returns early when `window.parent === window` | The next editing phase needs an explicit project transport adapter; moving DOM does not enable drafts or readiness messages |
| Geometry, picking and text use document queries and body overlays | They still need root-aware hit testing, composed event paths and camera conversions before native editing can be enabled |
| iframe unload previously supplied broad resource cleanup | Native mounting owns its React root, media, styles, event stream and preview globals; arbitrary project-level listeners, portals and font registrations remain compatibility work |

The lab includes direct playback commands, calculated composition metadata,
pointer-anchored zoom, pan, Fit, 100%, fixed controls and a canvas-details panel.
Project changes remount only the preview and preserve its frame/camera, with
playback paused. Bundle downloads are cancellable and are evaluated only after
the active request finishes, avoiding late script execution after switching.

Shadow DOM does not redefine `rem`, viewport units, media queries or document
selectors. Libraries that add CSS or fonts directly to the document need their
own adaptation. Bare relative URLs and global JavaScript side effects likewise
remain outside the scoped CSS solution. The first native build consolidates
the main project chunks and rejects extracted CSS configurations instead of
silently loading a project without those styles.

The [style-loader documentation](https://webpack.js.org/loaders/style-loader/)
describes custom insertion; the implementation here follows the installed
loader's module-path form. See `app/lab/preview-canvas/README.md` for current
controls and explicit compatibility boundaries, and the
`shadow-preview-canvas` OpenSpec change for remaining editing and evaluation work.
