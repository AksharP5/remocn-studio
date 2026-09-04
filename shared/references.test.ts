import { describe, expect, it } from "vitest";
import {
  caretOutside,
  dropLostReferences,
  dropReference,
  dropReferences,
  insertAt,
  insertReferences,
  lostReferences,
  type ReferenceCounts,
  type ReferenceKind,
  referenceAt,
  referenceOf,
  segmentsOf,
} from "@/shared/references";

function counts(image: number, element = 0, asset = 0): ReferenceCounts {
  return { asset, element, image };
}

function dropped(
  source: string,
  kind: ReferenceKind,
  index: number,
  held: ReferenceCounts
): string {
  return dropReference(source, kind, index, held).text;
}

function shape(source: string, held: ReferenceCounts) {
  return segmentsOf(source, held).map((segment) =>
    segment.kind === "reference"
      ? { index: segment.index, kind: segment.reference }
      : { kind: segment.kind, text: segment.text }
  );
}

describe("referenceOf", () => {
  it("numbers attachments from one", () => {
    expect(referenceOf("image", 0)).toBe("[Image #1]");
    expect(referenceOf("image", 2)).toBe("[Image #3]");
  });

  it("numbers selections from one, under their own label", () => {
    expect(referenceOf("element", 0)).toBe("[Element #1]");
    expect(referenceOf("element", 2)).toBe("[Element #3]");
  });

  it("numbers assets from one, under their own label", () => {
    expect(referenceOf("asset", 0)).toBe("[Asset #1]");
    expect(referenceOf("asset", 2)).toBe("[Asset #3]");
  });
});

describe("segmentsOf", () => {
  it("leaves a message without references in one piece", () => {
    expect(shape("build a title card", counts(2))).toEqual([
      { kind: "text", text: "build a title card" },
    ]);
  });

  it("cuts the text at every reference", () => {
    expect(
      shape("compare [Image #1] with [Image #2], please", counts(2))
    ).toEqual([
      { kind: "text", text: "compare " },
      { index: 0, kind: "image" },
      { kind: "text", text: " with " },
      { index: 1, kind: "image" },
      { kind: "text", text: ", please" },
    ]);
  });

  it("cuts the text at every selection too", () => {
    expect(
      shape("make [Element #1] bigger than [Element #2]", counts(0, 2))
    ).toEqual([
      { kind: "text", text: "make " },
      { index: 0, kind: "element" },
      { kind: "text", text: " bigger than " },
      { index: 1, kind: "element" },
    ]);
  });

  it("reads the two kinds against their own counters", () => {
    expect(shape("[Image #1] and [Element #1]", counts(1, 1))).toEqual([
      { index: 0, kind: "image" },
      { kind: "text", text: " and " },
      { index: 0, kind: "element" },
    ]);
  });

  it("keeps a selection as plain text when only images are held", () => {
    expect(shape("[Image #1] and [Element #1]", counts(1))).toEqual([
      { index: 0, kind: "image" },
      { kind: "text", text: " and [Element #1]" },
    ]);
  });

  it("keeps an image as plain text when only selections are held", () => {
    expect(shape("[Image #1] and [Element #1]", counts(0, 1))).toEqual([
      { kind: "text", text: "[Image #1] and " },
      { index: 0, kind: "element" },
    ]);
  });

  it("never lets one kind consume the other's number", () => {
    expect(shape("[Element #3]", counts(3))).toEqual([
      { kind: "text", text: "[Element #3]" },
    ]);
    expect(shape("[Image #3]", counts(0, 3))).toEqual([
      { kind: "text", text: "[Image #3]" },
    ]);
    expect(shape("[Asset #3]", counts(3, 3))).toEqual([
      { kind: "text", text: "[Asset #3]" },
    ]);
  });

  it("reads all three kinds against their own counters", () => {
    expect(
      shape("[Image #1] [Element #1] [Asset #1]", counts(1, 1, 1))
    ).toEqual([
      { index: 0, kind: "image" },
      { kind: "text", text: " " },
      { index: 0, kind: "element" },
      { kind: "text", text: " " },
      { index: 0, kind: "asset" },
    ]);
  });

  it("keeps an asset past the last one held as plain text", () => {
    expect(shape("use [Asset #7] instead", counts(0, 0, 3))).toEqual([
      { kind: "text", text: "use [Asset #7] instead" },
    ]);
  });

  it("keeps a reference past the last attachment as plain text", () => {
    expect(shape("use [Image #7] instead", counts(3))).toEqual([
      { kind: "text", text: "use [Image #7] instead" },
    ]);
  });

  it("keeps a reference past the last selection as plain text", () => {
    expect(shape("use [Element #7] instead", counts(0, 3))).toEqual([
      { kind: "text", text: "use [Element #7] instead" },
    ]);
  });

  it("resolves nothing when nothing is attached", () => {
    expect(shape("use [Image #1]", counts(0))).toEqual([
      { kind: "text", text: "use [Image #1]" },
    ]);
  });

  it("reads neither a zeroth image nor a padded number", () => {
    expect(shape("[Image #0] and [Image #01]", counts(3))).toEqual([
      { kind: "text", text: "[Image #0] and [Image #01]" },
    ]);
  });

  it("reads neither a zeroth element nor a padded number", () => {
    expect(shape("[Element #0] and [Element #01]", counts(0, 3))).toEqual([
      { kind: "text", text: "[Element #0] and [Element #01]" },
    ]);
  });

  it("gives every segment its own id", () => {
    const ids = segmentsOf("a [Image #1] b [Element #1] c", counts(1, 1)).map(
      (segment) => segment.id
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("insertReferences", () => {
  it("puts the reference where the caret is", () => {
    expect(insertReferences("compare  with that", 8, "image", 0, 1)).toEqual({
      caret: 18,
      text: "compare [Image #1] with that",
    });
  });

  it("puts a selection where the caret is", () => {
    expect(insertReferences("make  bigger", 5, "element", 0, 1)).toEqual({
      caret: 17,
      text: "make [Element #1] bigger",
    });
  });

  it("leaves the caret after the reference", () => {
    const { caret, text } = insertReferences("look at", 7, "image", 0, 1);

    expect(text).toBe("look at [Image #1] ");
    expect(caret).toBe(text.length);
  });

  it("spaces the reference off the words around it", () => {
    expect(insertReferences("look at", 7, "image", 0, 1).text).toBe(
      "look at [Image #1] "
    );
    expect(insertReferences("", 0, "image", 0, 1).text).toBe("[Image #1] ");
  });

  it("numbers a run of references in the order they arrived", () => {
    expect(insertReferences("", 0, "image", 1, 3).text).toBe(
      "[Image #2] [Image #3] [Image #4] "
    );
  });

  it("numbers a selection from its own list", () => {
    expect(insertReferences("", 0, "element", 1, 1).text).toBe("[Element #2] ");
  });

  it("changes nothing when nothing was attached", () => {
    expect(insertReferences("hello", 2, "image", 0, 0)).toEqual({
      caret: 2,
      text: "hello",
    });
  });
});

// A reference is atomic for deletion, and these make it atomic for insertion
// too. A caret inside `[Image #1]` used to be handed straight to `insertAt`,
// which cut the token in half — the halves are literal text, and the diff path
// then read reference 1 as lost and dropped the attachment it stood for. So
// pasting one picture silently removed another.
describe("caretOutside", () => {
  const held = counts(1);
  const text = "look at [Image #1] please";

  it("leaves a caret that is not in a reference alone", () => {
    expect(caretOutside(text, held, 0)).toBe(0);
    expect(caretOutside(text, held, 7)).toBe(7);
    expect(caretOutside(text, held, text.length)).toBe(text.length);
  });

  it("keeps the caret at either edge of the token, which is already outside", () => {
    expect(caretOutside(text, held, 8)).toBe(8);
    expect(caretOutside(text, held, 18)).toBe(18);
  });

  it("snaps a caret inside the token to the edge it is nearer", () => {
    expect(caretOutside(text, held, 9)).toBe(8);
    expect(caretOutside(text, held, 12)).toBe(8);
    expect(caretOutside(text, held, 14)).toBe(18);
    expect(caretOutside(text, held, 17)).toBe(18);
  });

  it("sends a caret exactly in the middle after the token", () => {
    expect(caretOutside(text, held, 13)).toBe(18);
  });

  it("clamps a caret outside the text", () => {
    expect(caretOutside(text, held, -5)).toBe(0);
    expect(caretOutside(text, held, 999)).toBe(text.length);
  });

  // A number past the attachment count is plain text, not a reference, so
  // there is nothing to protect and the caret must not move.
  it("does not move for a number nothing has attached", () => {
    expect(caretOutside("look at [Image #7] please", held, 13)).toBe(13);
  });

  it("keeps both attachments when a paste lands inside an existing reference", () => {
    const at = caretOutside(text, held, 13);
    const next = insertReferences(text, at, "image", 1, 1);

    expect(next.text).toBe("look at [Image #1] [Image #2] please");
    expect(lostReferences(text, next.text, held)).toEqual({
      asset: [],
      element: [],
      image: [],
    });
  });
});

describe("insertAt", () => {
  // A line break already separates what follows, so the space this used to add
  // was trailing whitespace in text that is sent to the model verbatim and
  // stored in the transcript that way.
  it("adds no space against a line break", () => {
    expect(insertAt("first\nsecond", 5, "[Image #1]").text).toBe(
      "first [Image #1]\nsecond"
    );
    expect(insertAt("first\nsecond", 6, "[Image #1]").text).toBe(
      "first\n[Image #1] second"
    );
  });

  it("still spaces the insertion off ordinary words", () => {
    expect(insertAt("first second", 5, "[Image #1]").text).toBe(
      "first [Image #1] second"
    );
  });
});

describe("dropReference", () => {
  it("takes the reference out with the attachment", () => {
    expect(dropped("use [Image #1] here", "image", 0, counts(1))).toBe(
      "use here"
    );
  });

  it("takes the reference out with the selection", () => {
    expect(
      dropped("make [Element #1] bigger", "element", 0, counts(0, 1))
    ).toBe("make bigger");
  });

  it("renumbers what is left so the text and the list agree", () => {
    expect(
      dropped(
        "compare [Image #1] and [Image #2] and [Image #3]",
        "image",
        0,
        counts(3)
      )
    ).toBe("compare and [Image #1] and [Image #2]");
  });

  it("renumbers the selections that survive", () => {
    expect(
      dropped(
        "[Element #1] then [Element #2] then [Element #3]",
        "element",
        0,
        counts(0, 3)
      )
    ).toBe("then [Element #1] then [Element #2]");
  });

  it("leaves lower references where they are", () => {
    expect(
      dropped(
        "compare [Image #1] and [Image #2] and [Image #3]",
        "image",
        1,
        counts(3)
      )
    ).toBe("compare [Image #1] and and [Image #2]");
  });

  it("renumbers one kind and leaves the other untouched", () => {
    expect(
      dropped(
        "[Image #1] [Element #1] [Image #2] [Element #2]",
        "image",
        0,
        counts(2, 2)
      )
    ).toBe("[Element #1] [Image #1] [Element #2]");
  });

  it("renumbers the assets that survive and nothing else", () => {
    expect(
      dropped(
        "[Asset #1] [Image #1] [Asset #2] [Asset #3]",
        "asset",
        0,
        counts(1, 0, 3)
      )
    ).toBe("[Image #1] [Asset #1] [Asset #2]");
  });

  it("eats the space after the reference when there is none before it", () => {
    expect(dropped("[Image #1] and [Image #2]", "image", 0, counts(2))).toBe(
      "and [Image #1]"
    );
  });

  it("leaves a number nobody was pointing at alone", () => {
    expect(
      dropped("use [Image #1] not [Image #7]", "image", 0, counts(3))
    ).toBe("use not [Image #7]");
  });

  it("removes every mention of the attachment that went", () => {
    expect(
      dropped("[Image #1] then [Image #1] again", "image", 0, counts(1))
    ).toBe("then again");
  });

  it("leaves the caret where the reference was", () => {
    const result = dropReference(
      "compare [Image #1] and [Image #2]",
      "image",
      0,
      counts(2),
      8
    );

    expect(result.text).toBe("compare and [Image #1]");
    expect(result.text.slice(0, result.caret)).toBe("compare");
  });

  it("follows the mention the caret was at, not the first", () => {
    const result = dropReference(
      "[Image #1] then [Image #1]",
      "image",
      0,
      counts(1),
      16
    );

    expect(result.text).toBe("then");
    expect(result.caret).toBe(4);
  });
});

describe("referenceAt", () => {
  const TEXT = "compare [Image #1] and [Image #2]";
  const MIXED = "make [Element #1] like [Image #1]";

  it("takes the whole reference when backspacing just after it", () => {
    expect(referenceAt(TEXT, counts(2), 18, false)).toEqual({
      end: 18,
      index: 0,
      reference: "image",
      start: 8,
    });
  });

  it("says which list the reference under the caret came from", () => {
    expect(referenceAt(MIXED, counts(1, 1), 17, false)?.reference).toBe(
      "element"
    );
    expect(referenceAt(MIXED, counts(1, 1), 32, false)?.reference).toBe(
      "image"
    );
  });

  it("takes the whole reference from inside it, either way", () => {
    expect(referenceAt(TEXT, counts(2), 12, false)?.index).toBe(0);
    expect(referenceAt(TEXT, counts(2), 12, true)?.index).toBe(0);
  });

  it("takes the whole reference when deleting forward at its start", () => {
    expect(referenceAt(TEXT, counts(2), 8, true)?.index).toBe(0);
  });

  it("leaves the character before the reference to an ordinary backspace", () => {
    expect(referenceAt(TEXT, counts(2), 8, false)).toBeNull();
  });

  it("leaves the character after the reference to an ordinary delete", () => {
    expect(referenceAt(TEXT, counts(2), 18, true)).toBeNull();
  });

  it("is blind to a number past the last attachment", () => {
    expect(referenceAt("use [Image #7]", counts(3), 14, false)).toBeNull();
  });

  it("is blind to a selection nobody is holding", () => {
    expect(referenceAt("use [Element #1]", counts(3), 16, false)).toBeNull();
  });
});

describe("lostReferences", () => {
  it("reports the reference that left the text", () => {
    expect(
      lostReferences(
        "compare [Image #1] and [Image #2]",
        "compare and [Image #2]",
        counts(2)
      )
    ).toEqual({ asset: [], element: [], image: [0] });
  });

  it("reports the selection that left the text", () => {
    expect(
      lostReferences("[Element #1] [Element #2]", "[Element #2]", counts(0, 2))
    ).toEqual({ asset: [], element: [0], image: [] });
  });

  it("reports every reference a wholesale delete took", () => {
    expect(
      lostReferences("[Image #1] [Element #1] [Image #2]", "", counts(2, 1))
    ).toEqual({ asset: [], element: [0], image: [0, 1] });
  });

  it("reports nothing when a reference is only mentioned once more", () => {
    expect(
      lostReferences("[Image #1]", "[Image #1] and [Image #1]", counts(1))
    ).toEqual({ asset: [], element: [], image: [] });
  });

  it("reports nothing for an attachment that was never referenced", () => {
    expect(lostReferences("hello", "hell", counts(2))).toEqual({
      asset: [],
      element: [],
      image: [],
    });
  });
});

describe("dropReferences", () => {
  it("removes several at once and renumbers what survives", () => {
    expect(
      dropReferences(
        "a [Image #1] b [Image #2] c [Image #3]",
        "image",
        [0, 2],
        counts(3)
      )
    ).toBe("a b [Image #1] c");
  });
});

describe("dropLostReferences", () => {
  it("settles both kinds in one pass", () => {
    expect(
      dropLostReferences(
        "[Image #1] [Element #1] [Image #2] [Element #2]",
        { asset: [], element: [0], image: [0] },
        counts(2, 2)
      )
    ).toBe("[Image #1] [Element #1]");
  });

  it("leaves the text alone when nothing was lost", () => {
    expect(
      dropLostReferences(
        "[Image #1] and [Element #1]",
        { asset: [], element: [], image: [] },
        counts(1, 1)
      )
    ).toBe("[Image #1] and [Element #1]");
  });
});
