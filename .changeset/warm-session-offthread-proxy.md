---
"remocn-studio": patch
---

Snapshot and the design check work again on a video that uses footage. The warm
render page was told `proxyPort: 0`, so `OffthreadVideo` fetched every frame
from `http://localhost:0/proxy?…` — a port Chrome refuses outright — and the
capture hung until it failed with Remotion's guess about low disk space. The
session now starts the same offthread-video proxy `renderStill` prepares and
gives the page its real port, closing it with the session. The page also gets a
source map at last, so the browser's own log lines stop throwing on the way out.
