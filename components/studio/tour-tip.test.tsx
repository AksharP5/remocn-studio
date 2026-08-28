import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TourCard } from "@/components/studio/tour-tip";
import type { Tours } from "@/hooks/use-tours";
import { TOUR_TIPS, type TourId } from "@/lib/studio/tours";

function tipOf(id: TourId) {
  const found = TOUR_TIPS.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`no tip called ${id}`);
  }
  return found;
}

function tours(shape: Partial<Tours> = {}): Tours {
  return {
    close: vi.fn(),
    dismiss: vi.fn(),
    hasSeenAny: false,
    replay: vi.fn(),
    reveal: null,
    tip: tipOf("composer"),
    ...shape,
  };
}

function anchor(id: TourId) {
  const element = document.createElement("div");
  element.dataset.tour = id;
  document.body.append(element);
  return element;
}

// The anchors are put on the body by hand, so they are taken off by hand:
// Testing Library only unmounts what it rendered.
afterEach(() => {
  for (const element of document.querySelectorAll("[data-tour]")) {
    element.remove();
  }
});

describe("TourCard", () => {
  it("points at the element that carries the tip's name", () => {
    anchor("composer");
    render(<TourCard tours={tours()} />);

    // Base UI keeps the popup hidden until it has measured the anchor, which
    // jsdom never does — being on the page against the right tip is what this
    // is about.
    expect(screen.getByText(tipOf("composer").title)).toBeInTheDocument();
  });

  it("shows nothing when the element it would point at is not on the page", () => {
    render(<TourCard tours={tours()} />);

    expect(screen.queryByText(tipOf("composer").title)).not.toBeInTheDocument();
  });

  it("shows nothing when there is no tip to give", () => {
    anchor("composer");
    render(<TourCard tours={tours({ tip: null })} />);

    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });

  it("answers the tip on Got it", () => {
    anchor("composer");
    const dismiss = vi.fn();
    render(<TourCard tours={tours({ dismiss })} />);

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("offers Show me only for a tip that has something to show", () => {
    anchor("assets");
    const reveal = vi.fn();
    const { rerender } = render(
      <TourCard tours={tours({ reveal, tip: tipOf("assets") })} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    expect(reveal).toHaveBeenCalledTimes(1);

    rerender(<TourCard tours={tours({ reveal: null })} />);
    expect(screen.queryByRole("button", { name: "Show me" })).toBeNull();
  });
});
