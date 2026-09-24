## One camera update per frame

The pointer, wheel and pinch handlers no longer call `setCamera` themselves.
Each queues a pure step (`camera → camera`, the same `panPreviewCamera` /
`zoomPreviewCamera` calls as before) and one `requestAnimationFrame` folds the
queue into a single state update. Steps compose in arrival order, so a pinch
stays anchored under the pointer and a pan's total equals the pointer's travel.
The handlers now return in microseconds, which keeps WebKit delivering moves at
the display rate instead of coalescing them behind a render. Tearing the
listeners down flushes the queue rather than dropping it.

## What a camera change re-renders

The camera lives in `usePreviewCamera` inside `CanvasPreview`, so each change
re-rendered every child of the pane. The stage, the frame outline and the Inspect
markers do depend on it; the inspector (header, Snapshot, Export, the properties
pane or the video details) does not. `CanvasInspector` is memoised on the values
it reads — whether it is shown, whether there is a selection, the metadata, the
duration and the tools — so a pan no longer re-renders the properties pane.

## Middle button

The camera already starts a pan on `button === 1`. In the app the cursor changes
but the view does not move, so the down is seen and the moves are not. Which
layer loses them (WKWebView / wry, pointer capture, or a listener) is established
from an event log in the running app before the fix is chosen.
