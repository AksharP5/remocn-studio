## Context

REM-571 is the checklist; this change is how it is built. The measurements come
from the three audits: a `<Profiler>` probe over the real `<Page/>` under
happy-dom (proportions, not absolute WKWebView times), `next experimental-analyze`
for bundle attribution, and the live app-data folder and `sidecar.log` for the
preview host.

## Decisions

- Render fan-out is fixed at its source — context shape, stable object identity
  and leaf subscriptions — rather than by sprinkling `memo`.
- Streamed deltas are coalesced on both sides: the sidecar emits and persists at
  a bounded rate, the webview commits at most once per frame.
- `components/ui/**` stays generated; the Button's cursor and hover transition
  are set from `app/globals.css` against `[data-slot="button"]`.
- The webpack filesystem cache stays off; warm starts are won by overlapping the
  two compilers and by not doing work nobody reads.
