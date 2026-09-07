import { describe, expect, it } from "bun:test";
import {
  attachmentOf,
  IMAGE_EXTENSIONS,
  isImageMediaType,
  isMediaType,
  isPlayable,
  mediaOf,
  PLAYABLE_EXTENSIONS,
  unsendableImageOf,
} from "@/lib/studio/attachments";

describe("mediaOf", () => {
  it("reads a picture, a video and a sound off their extensions", () => {
    expect(mediaOf("/tmp/logo.PNG")).toEqual({
      mediaType: "image/png",
      name: "logo.PNG",
      path: "/tmp/logo.PNG",
    });
    expect(mediaOf("/tmp/intro.mp4")?.mediaType).toBe("video/mp4");
    expect(mediaOf("/tmp/clip.mov")?.mediaType).toBe("video/quicktime");
    expect(mediaOf("/tmp/theme.mp3")?.mediaType).toBe("audio/mpeg");
    expect(mediaOf("/tmp/voice.m4a")?.mediaType).toBe("audio/mp4");
  });

  it("answers null for anything the app cannot carry", () => {
    expect(mediaOf("/tmp/notes.md")).toBeNull();
    expect(mediaOf("/tmp/Makefile")).toBeNull();
    expect(mediaOf("")).toBeNull();
  });
});

describe("attachmentOf", () => {
  it("takes pictures, because only a picture can reach the model", () => {
    expect(attachmentOf("/tmp/shot.png")?.mediaType).toBe("image/png");
  });

  it("refuses video and audio, which travel as media instead", () => {
    expect(attachmentOf("/tmp/intro.mp4")).toBeNull();
    expect(attachmentOf("/tmp/theme.wav")).toBeNull();
  });
});

describe("the two extension lists", () => {
  it("split cleanly, with nothing in both", () => {
    const overlap = IMAGE_EXTENSIONS.filter((extension) =>
      PLAYABLE_EXTENSIONS.includes(extension)
    );

    expect(overlap).toEqual([]);
    expect(IMAGE_EXTENSIONS).toContain("png");
    expect(PLAYABLE_EXTENSIONS).toContain("mp4");
    expect(PLAYABLE_EXTENSIONS).toContain("wav");
  });
});

// Video and audio are never sent to the model — they are copied into
// `public/library/` and played by the project's own renderer — so there was
// nothing for the old thirteen-extension list to be strict about. `.m4v` is
// what the Apple ecosystem exports, `.mkv` and `.avi` what footage arrives in.
describe("mediaOf, on the formats that used to be refused", () => {
  it("takes the video containers people actually have", () => {
    expect(mediaOf("/x/clip.m4v")?.mediaType).toBe("video/x-m4v");
    expect(mediaOf("/x/clip.mkv")?.mediaType).toBe("video/x-matroska");
    expect(mediaOf("/x/clip.avi")?.mediaType).toBe("video/x-msvideo");
    expect(mediaOf("/x/clip.mpeg")?.mediaType).toBe("video/mpeg");
  });

  it("takes the lossless and modern audio formats", () => {
    expect(mediaOf("/x/song.flac")?.mediaType).toBe("audio/flac");
    expect(mediaOf("/x/song.aiff")?.mediaType).toBe("audio/aiff");
    expect(mediaOf("/x/song.opus")?.mediaType).toBe("audio/opus");
    expect(mediaOf("/x/song.oga")?.mediaType).toBe("audio/ogg");
  });

  it("still refuses what is genuinely not media", () => {
    expect(mediaOf("/x/Scene.tsx")).toBeNull();
    expect(mediaOf("/x/notes.md")).toBeNull();
  });

  // The API reads jpeg, png, gif and webp and nothing else, so these stay
  // refused — what changes is that the refusal can now name them.
  it("keeps a picture the model cannot read out, but recognises it", () => {
    expect(mediaOf("/x/holiday.heic")).toBeNull();
    expect(unsendableImageOf("/x/holiday.heic")).toBe("HEIC");
    expect(unsendableImageOf("/x/shot.png")).toBeNull();
    expect(unsendableImageOf("/x/notes.md")).toBeNull();
  });
});

describe("isPlayable", () => {
  it("is what tells a file that plays from one the model can look at", () => {
    expect(isPlayable("image/png")).toBe(false);
    expect(isPlayable("video/mp4")).toBe(true);
    expect(isPlayable("audio/wav")).toBe(true);
  });
});

describe("the media type guards", () => {
  it("narrow to what the contract actually carries", () => {
    expect(isImageMediaType("image/png")).toBe(true);
    expect(isImageMediaType("video/mp4")).toBe(false);
    expect(isMediaType("video/mp4")).toBe(true);
    expect(isMediaType("application/pdf")).toBe(false);
  });
});
