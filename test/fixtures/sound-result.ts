import type { SoundResult } from "@/shared/ipc";

export const SOUND_RESULT: SoundResult = {
  operationId: "sound_door",
  request: { connectionId: "cn_1", durationSeconds: 2, format: "mp3_44100_128", name: "Wooden door", text: "A wooden door closing softly" },
  asset: {
    audiomap: null, category: null, clip: null, createdAt: 1, dependencies: [], description: "A wooden door closing softly", duration: null,
    files: ["sound_door.mp3"], name: "Wooden door", path: "/library/wooden-door", preview: null, proxied: false, role: null, slug: "wooden-door", type: "audio",
    source: { author: "My sounds", authorUrl: "", connectionId: "cn_1", connectionName: "My sounds", durationSeconds: 2, format: "mp3_44100_128", id: "sound_door", model: "eleven_text_to_sound_v2", provider: "elevenlabs", text: "A wooden door closing softly", url: "https://elevenlabs.io/sound-effects" },
  },
};
