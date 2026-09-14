import { expect, it, mock } from "bun:test";
import { mockConvertFileSrc } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { AudioTransport } from "./audio-transport";

function Player() {
  const player = useAudioPlayer("/library/sound.mp3");
  return (
    <>
      <AudioTransport name="Door" player={player} />
      {player.error === null ? null : <p role="alert">{player.error}</p>}
    </>
  );
}

it("plays local media on request, measures its duration, seeks, and pauses on unmount", async () => {
  mockConvertFileSrc("macos");
  const { unmount } = render(<Player />);
  const audio = screen.getByLabelText("Audio for Door") as HTMLAudioElement;
  const pause = mock(() => fireEvent.pause(audio));
  const play = mock(async () => fireEvent.play(audio));
  Object.defineProperties(audio, {
    duration: { value: 3.4 },
    pause: { value: pause },
    paused: { configurable: true, value: true },
    play: { value: play },
  });
  expect(audio).not.toHaveAttribute("autoplay");
  expect(play).not.toHaveBeenCalled();
  fireEvent.loadedMetadata(audio);
  expect(screen.getByRole("slider")).toHaveAttribute("max", "3.4");
  fireEvent.click(screen.getByRole("button", { name: "Play Door" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Pause Door" })).toBeEnabled()
  );
  fireEvent.change(screen.getByRole("slider"), { target: { value: "1.5" } });
  expect(audio.currentTime).toBe(1.5);
  expect(screen.getByRole("slider")).toHaveAttribute(
    "aria-valuetext",
    "0:01 of 0:03"
  );
  Object.defineProperty(audio, "paused", { value: false });
  fireEvent.click(screen.getByRole("button", { name: "Pause Door" }));
  expect(pause).toHaveBeenCalledTimes(1);
  unmount();
  expect(pause).toHaveBeenCalledTimes(2);
});

it("shows unreadable-file and playback failures without autoplay or fake progress", async () => {
  mockConvertFileSrc("macos");
  render(<Player />);
  const audio = screen.getByLabelText("Audio for Door");
  Object.defineProperty(audio, "play", {
    value: mock(() => Promise.reject(new Error("denied"))),
  });
  fireEvent.click(screen.getByRole("button", { name: "Play Door" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Playback could not start"
    )
  );
  fireEvent.error(audio);
  expect(screen.getByRole("alert")).toHaveTextContent("moved or deleted");
  expect(screen.getByRole("slider")).toBeDisabled();
});
