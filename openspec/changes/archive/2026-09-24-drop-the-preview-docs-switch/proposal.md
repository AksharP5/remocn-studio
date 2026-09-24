## Why

The Preview / Docs switch sits in the canvas header next to the camera toolbar
and reads as one more control competing for the top of the canvas, while the
preview is where the person spends nearly all their time. Docs already has its
own ways in — ⌘D, View › Preview or Docs, the command palette, and a stage row in
the Video dock that opens its document — so the switch only has to survive where
it is needed: to get back from a document.

## What Changes

- The preview's header no longer carries the Preview / Docs switch.
- In Docs, the header carries a "Preview" back button in its place.
- ⌘D, the View menu row, the command palette entry and the stage rows keep
  opening Docs as before.

## Capabilities

### Modified Capabilities

- `shell/layout-and-panes`: the header's switch becomes a back button shown only
  in Docs.

## Non-goals

- Moving Docs into the inspector's icon bar: it switches the whole pane, not the
  inspector, and would be dead in half its states.
- Changing what Docs shows or how its tabs work.

## Impact

Webview only: `components/studio/preview-pane.tsx`. No hook, IPC or spec change
outside the one requirement.
