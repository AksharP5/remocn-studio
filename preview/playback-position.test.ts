import { expect, it } from "bun:test";
import { playbackPositions } from "./playback-position";

it("restores 13 seconds across a full iframe rebuild and isolates compositions", () => {
  sessionStorage.clear();
  const before = playbackPositions(sessionStorage, "/project");
  before.remember("intro", { frame: 390, playing: false });
  before.persist();
  expect(
    playbackPositions(sessionStorage, "/other-project").restore("intro", 900)
  ).toEqual({ frame: 0, playing: false });
  const after = playbackPositions(sessionStorage, "/project");
  expect(after.restore("intro", 900)).toEqual({ frame: 390, playing: false });
  expect(after.restore("other", 900)).toEqual({ frame: 0, playing: false });
  expect(after.restore("intro", 120)).toEqual({ frame: 119, playing: false });
});

it("keeps playback state through remounts and tolerates corrupt storage", () => {
  sessionStorage.setItem("remocn-preview-playback:/project", "broken");
  const positions = playbackPositions(sessionStorage, "/project");
  positions.remember("intro", { frame: 120, playing: true });
  expect(positions.restore("intro", 900)).toEqual({
    frame: 120,
    playing: true,
  });
});
