---
"remocn-studio": patch
---

Phone and camera footage no longer stutters in exports of new videos. The agent now embeds footage with `<Video>` from `@remotion/media`, which new projects declare. That component shows every frame of files whose frames start a fraction of a millisecond after their slot, where `OffthreadVideo` repeated one frame and skipped the next. It also matches the source's brightness. The design check now names each clip that `OffthreadVideo` would show late, counts its late frames, and says how to fix it.
