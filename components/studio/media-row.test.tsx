import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { render, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { ThumbnailError } from "@/lib/studio/thumbnail";
import type { PromptMedia } from "@/shared/ipc";

const answer: { poster: Effect.Effect<string, ThumbnailError> } = {
  poster: Effect.succeed("blob:poster"),
};

mock.module("@/lib/studio/posters", () => ({
  knownPoster: () => null,
  posterOf: () => answer.poster,
}));

const { MediaRow } = await import("@/components/studio/media-row");

const CLIP: PromptMedia = {
  mediaType: "video/mp4",
  name: "clip.mp4",
  path: "/Users/me/Movies/clip.mp4",
};

describe("MediaRow", () => {
  beforeEach(() => {
    mockIPC(() => null);
    const internals = window as unknown as {
      __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
    };
    internals.__TAURI_INTERNALS__.convertFileSrc = (path) =>
      `asset://localhost/${encodeURIComponent(path)}`;
  });

  it("shows a still of a video instead of a live player", async () => {
    answer.poster = Effect.succeed("blob:poster");
    const { container } = render(<MediaRow items={[CLIP]} />);

    await waitFor(() =>
      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        "blob:poster"
      )
    );
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("video")).toBeNull();
  });

  it("falls back to the video itself when no still can be taken", async () => {
    answer.poster = Effect.fail(
      new ThumbnailError({ message: "clip.mp4 could not be decoded" })
    );
    const { container } = render(<MediaRow items={[CLIP]} />);

    await waitFor(() =>
      expect(container.querySelector("video")).not.toBeNull()
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
