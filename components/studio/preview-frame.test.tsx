import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { PreviewFrame } from "@/components/studio/preview-pane";

describe("PreviewFrame", () => {
  it("keeps a late iframe hidden until its own document has loaded", () => {
    render(
      <PreviewFrame
        isBooting={false}
        ref={createRef<HTMLIFrameElement>()}
        url="http://127.0.0.1:51749"
      />
    );

    const frame = screen.getByTitle("Remotion preview");
    expect(frame).toHaveClass("opacity-0");

    fireEvent.load(frame);
    expect(frame).toHaveClass("opacity-100");
  });
});
