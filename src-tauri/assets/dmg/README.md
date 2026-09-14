# DMG background

`../dmg-background.png` is a static 720 × 460 capture of the app's Paper
NeuroNoise shader. The palette and uniforms follow
`components/studio/shader-field.tsx`; the opacity and mask follow
`components/studio/startup-backdrop.tsx`. The base color follows the dark
sidebar in `app/globals.css`. Animation is frozen at frame 120, speed 0.

Finder displays the PNG behind the real application and Applications icons.
The image is committed, so release builds do not need a browser or WebGL.

To regenerate from the repository root on macOS with Google Chrome installed:

```sh
bun build src-tauri/assets/dmg/background.js --outdir /tmp/remocn-dmg-background --target browser
cp src-tauri/assets/dmg/background.html /tmp/remocn-dmg-background/background.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --no-first-run --no-default-browser-check \
  --user-data-dir=/tmp/remocn-dmg-chrome \
  --allow-file-access-from-files --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=720,460 \
  --virtual-time-budget=3000 \
  --screenshot="$PWD/src-tauri/assets/dmg-background.png" \
  file:///tmp/remocn-dmg-background/background.html
```

Inspect the PNG after capturing: it should show violet strands fading into a
dark lower half, not an empty background. Its dimensions must match
`bundle.macOS.dmg.windowSize` in `src-tauri/tauri.conf.json`.
