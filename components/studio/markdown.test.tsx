import { describe, expect, it, mock } from "bun:test";
import { render, renderHook, screen } from "@testing-library/react";
import { Markdown } from "@/components/studio/markdown";
import { useHighlighterFor } from "@/hooks/use-code-highlighter";

describe("Markdown", () => {
  it("shows the words at once and formats them when the renderer arrives", async () => {
    render(<Markdown isAnimated={false}>{"A **bold** claim"}</Markdown>);

    expect(screen.getByText("A **bold** claim")).toBeVisible();
    expect(await screen.findByText("bold")).toContainHTML("bold");
    expect(screen.queryByText("A **bold** claim")).toBeNull();
  });
});

describe("useHighlighterFor", () => {
  it("asks for the highlighter only once a code block appears", () => {
    const request = mock();
    const hook = renderHook(
      ({ text }: { text: string }) =>
        useHighlighterFor({ plugin: null, request }, text),
      { initialProps: { text: "Nothing to highlight here." } }
    );

    expect(request).not.toHaveBeenCalled();

    hook.rerender({ text: "Here it is:\n\n```tsx\n<Title />\n```" });

    expect(request).toHaveBeenCalledTimes(1);
  });
});
