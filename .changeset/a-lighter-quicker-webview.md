---
"remocn-studio": patch
---

The studio does far less work while it streams and while you type:
- A streamed reply re-renders the transcript and nothing else, and lands at most once per frame; typing re-renders only the composer.
- Playing a video moves only the seek bar, and panning or zooming the canvas moves only the stage, the rulers and the overlays.
- The window opens on 1.3 MB less JavaScript: the markdown renderer, the code highlighter, the properties controls and the crash reporter load when they are first needed, and the release no longer carries the lab pages or preloads three fonts it does not use.
- Chats you have not opened in a while are read back from history when you return to them, and videos in a chat show a still frame instead of a live player.
