# Appearance lab

Open `/lab/paper-ui` on the existing development server.

The page renders the real, unchanged `AppShell`: the same sidebar, composer,
screens, controls, content, and behavior as the main Studio. It uses the same
workspace and services, so Studio actions operate normally on your projects.
There is no mock interface or separate layout.

The lab changes only font families, palette tokens, and the shared corner-radius
token. It preserves spacing, font sizes, weights, component dimensions, and
responsive behavior. DM Sans and the existing Golos fallback for Cyrillic remain
from the typography pass. The palette now follows the user's Codex desktop
screenshot; these are reference-based choices, not official Codex tokens.

The current configuration uses DM Sans, a neutral accent, 5 px base radius,
dark background 24, surface contrast 10, and dark borders at 8%. The dark palette
is applied in `app/globals.css`: canvas and sidebar `#181818`, cards `#222222`,
popovers and sent messages `#2c2c2c`, and input surfaces `#333333`. Primary actions
use white. Sent messages use the existing secondary bubble variant. The light
theme retains its existing palette.

Use **Studio / Preview** to compare the shipped theme with further adjustments
without resetting Studio state. They match until the lab settings are changed.
The sliders button opens floating appearance controls without resizing Studio.
Close that panel to see the complete interface.

## Saving

- **Save to project** writes `app/lab/paper-ui/paper-ui.config.json`. Select the
  repository root the first time. This requires the File System Access API
  (Chrome or Edge) and checks the selected folder's package name before writing.
- **Download** exports the same JSON where folder access is unavailable.
- **Load JSON** imports a saved theme. Version 1 imports retain only color and
  radius values; obsolete density and layout settings are ignored.
- **Reset** restores the configuration loaded when the page opened.

Version 2 exports the full parameters and light/dark CSS tokens. The font choice
is portable; the runtime substitutes Next's generated font family names.

The route overrides existing tokens through
`:root:has([data-paper-ui-preview="paper"])`, so menus and dialogs rendered in
body portals receive the same appearance. The selector stops matching when
Studio is selected or the route unmounts. It does not persist a theme change
to Studio preferences, and the production route imports nothing from this lab.

After a theme is approved, promote the saved tokens and its font setup to the
production design system as a separate change.
