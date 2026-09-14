# Application icons

`../app-icon.png` and `../app-icon-light.png` are the 1024 × 1024 RGBA production
masters for the selected Violet design. Both use the same macOS contour with
transparent padding. Do not generate icons from the checkerboard concept images
in `assets/icon-options`.

The top-level PNG, ICNS, and ICO assets are generated from the dark master with
`bun run tauri icon src-tauri/app-icon.png`. Tauri also creates mobile assets;
this desktop project keeps only the top-level files.

`themes/dark.png` and `themes/light.png` are 512 × 512 exports embedded directly
in the native binary. Regenerate each using Tauri's `--png 512 --output <dir>`
option, then copy `512x512.png` to its named file in `themes/`.

The ThemeProvider sends next-themes' resolved light/dark value to `set_app_icon`,
so explicit preferences and System mode use the same source of truth. Updates
are serialized. On macOS, AppKit changes the running application's Dock icon on
the main thread; other desktop platforms update their window icons. Browser
previews skip the native call.

The installed bundle/Finder/DMG icon remains the dark default. Runtime switching
does not modify the signed application bundle and does not promise automatic
Finder icon changes when the application is closed.
