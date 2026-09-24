---
"remocn-studio": patch
---

The seek bar marks the video's scenes with short ticks and each scene's name
above its segment, the current one highlighted; clicking a name jumps to the
scene. The playback panel has a speed slider (0.25×, 0.5×, 1×, 2×) for the
preview, and a shorter volume slider in the same style; its text is set in one
face and size. The agent now names every scene and describes it in studio.json
with a scene object its objects belong to, and the design check reports a scene
without a name or a scene object. In the object list, clicking a scene, or an
object that is not on screen, moves the playhead to that scene.
