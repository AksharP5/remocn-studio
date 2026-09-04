import { describe, expect, it } from "vitest";
import { stockName } from "@/lib/studio/stock";
import type { StockItem } from "@/shared/library";

// A real Pexels alt string: a sentence, already cut mid-clause at the source.
const ALT = "Dynamic waves crashing in the turquoise ocean, showcasing";

const photo = (over: Partial<StockItem> = {}): StockItem => ({
  author: "Magda Ehlers",
  authorUrl: "https://www.pexels.com/@magda-ehlers",
  download: "https://images.pexels.com/photos/1/original.jpg",
  duration: null,
  height: 1200,
  id: "1",
  kind: "photo",
  name: ALT,
  thumbnail: "https://images.pexels.com/photos/1/medium.jpg",
  url: "https://www.pexels.com/photo/1",
  width: 1600,
  ...over,
});

// The grid is two columns in a 288px sidebar — about twelve characters a
// label — so a sentence made every card read `Dynamic wa…`, which is the part
// that does not tell one photo from another.
describe("stockName", () => {
  it("names a saved photo by what was searched for and who took it", () => {
    expect(stockName("ocean", photo())).toBe("ocean — Magda Ehlers");
  });

  it("leads with the query, which is the part that fits the label", () => {
    expect(stockName("ocean", photo()).startsWith("ocean")).toBe(true);
  });

  it("tidies the query rather than carrying it as typed", () => {
    expect(stockName("  slow   motion  ", photo())).toBe(
      "slow motion — Magda Ehlers"
    );
  });

  it("keeps the query alone when the pair would not fit a label", () => {
    const long = photo({
      author: "A Photographer With A Very Long Name Indeed",
    });

    expect(stockName("waves at golden hour", long)).toBe(
      "waves at golden hour"
    );
  });

  it("falls back to the kind and author when nothing was searched for", () => {
    expect(stockName("", photo())).toBe("Photo by Magda Ehlers");
    expect(stockName("", photo({ kind: "video" }))).toBe(
      "Video by Magda Ehlers"
    );
  });

  it("keeps whatever name it has when there is neither query nor author", () => {
    expect(stockName("", photo({ author: "" }))).toBe(ALT);
  });

  it("names an unattributed result by the query alone", () => {
    expect(stockName("ocean", photo({ author: "" }))).toBe("ocean");
  });
});
