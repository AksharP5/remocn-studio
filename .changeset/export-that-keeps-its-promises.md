---
"remocn-studio": minor
---

Export asks what you want and renders what you are looking at.

- **A dialog before the render**: a preset to start from — YouTube, Shorts ·
  Reels · TikTok, Instagram Feed — then format (MP4/H.264, WebM/VP9, GIF,
  MOV/ProRes), resolution (source, or a 720, 1080 or 2160 short side) and
  quality (Draft, Standard, High, or the project's own settings). The file it
  will write is a field in the same dialog, not a save panel afterwards: the
  name follows the preset and the format until you type one, and the folder is
  `out` until you choose another. A summary says the real output size, the
  container and the length; a preset that does not match the video's shape warns
  without changing it; a GIF says it carries no audio. Format and folder are
  remembered per project.
- **A WebGL scene exports without editing `remotion.config.ts` first.** The
  render browser is a headless Chrome of its own and Remotion 4 gives it no GL
  backend by default, so a shader never finished compiling and the render died
  with stock advice about disk space. The studio now chooses `angle` on the
  desktop, measures whether that browser can really make a WebGL2 context, and
  falls back to software once if it cannot — while never substituting for a
  backend the project chose itself. Every renderer-backed feature shares that
  one policy.
- **A `delayRender()` that never cleared is no longer blamed on WebGL.**
  Failures are classified — no GL context, a lost one, a dead browser, a missing
  asset, the encoder, the scene's own code — and the GL sentence only appears
  when the browser really could not make a context.
- **The project's own render settings actually reach the render.** They are read
  from the installed Remotion's own option registry, in a fresh process so an
  edited `remotion.config.ts` is never served from a module cache, and forwarded
  only where that Remotion's `renderMedia` accepts them. A setting that the
  chosen codec would refuse — a CRF on ProRes, a ProRes profile on H.264, an
  audio codec the container cannot hold — is left out and said out loud.
- **A render is pinned to the bundle and assets it started with**, so an agent
  saving a file mid-export cannot change frames that are still being encoded.
- **The preview and the export agree on the composition**: `calculateMetadata`
  is resolved in the preview too, so a composition that computes its size plays
  in the pane and exports at the size the dialog promised. Element changes
  waiting in the composer block the export rather than being quietly left out of
  it.
