import { describe, expect, it } from "vitest";
import { elementsOf } from "./prompt";

const ELEMENT = {
  column: 7,
  component: "HeroScene",
  composition: "Main",
  file: "/Users/me/video/src/HeroScene.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

describe("elementsOf", () => {
  it("includes structured tuning changes without runtime target identity", () => {
    expect(
      elementsOf([
        {
          ...ELEMENT,
          tuningChanges: [
            { from: 12, path: "amount", to: 20 },
            { from: "0px 0px", path: "style.translate", to: "0px 24px" },
          ],
        },
      ])
    ).toContain(
      'Requested changes:\n- amount: 12 → 20\n- style.translate: "0px 0px" → "0px 24px"'
    );
  });

  // The two chips one Add leaves reach the agent as two blocks about the same
  // element. Only one of them is a request; the other is a fact it must not
  // act on, or the same edit would land twice.
  it("says outright which changes the studio has already written", () => {
    const block = elementsOf([
      {
        ...ELEMENT,
        tuningChanges: [
          {
            from: 16,
            owner: {
              component: "Title",
              file: "src/videos/intro/Title.tsx",
              line: 24,
              name: "Headline",
            },
            path: "style.fontSize",
            to: 48,
          },
        ],
        written: true,
      },
    ]);

    expect(block).toContain(
      "Already written by the studio on Title ‹Headline› (src/videos/intro/Title.tsx:24): These are in the file already — leave them exactly as they are."
    );
    expect(block).toContain("- style.fontSize: 16 → 48");
    expect(block).not.toContain("Requested changes");
  });

  it("heads each group with the component that owns those changes", () => {
    const block = elementsOf([
      {
        ...ELEMENT,
        tuningChanges: [
          {
            from: 12,
            owner: {
              component: "WordPush",
              file: "components/WordPush.tsx",
              line: 243,
              name: "Pushed line",
            },
            path: "amount",
            to: 20,
          },
          {
            from: 1,
            owner: {
              component: "ClaimScene",
              file: "src/videos/vidrush/ClaimScene.tsx",
              line: 88,
              name: null,
            },
            path: "claimSize",
            to: 2,
          },
        ],
      },
    ]);

    expect(block).toContain(
      "Requested changes on WordPush ‹Pushed line› (components/WordPush.tsx:243):\n- amount: 12 → 20"
    );
    expect(block).toContain(
      "Requested changes on ClaimScene (src/videos/vidrush/ClaimScene.tsx:88):\n- claimSize: 1 → 2"
    );
  });

  it("keeps the changes of one owner together, in the order the chain gave them", () => {
    const camera = {
      component: "CameraRig",
      file: "src/videos/vidrush/CameraRig.tsx",
      line: 12,
      name: null,
    };
    const word = {
      component: "WordPush",
      file: "components/WordPush.tsx",
      line: 243,
      name: null,
    };

    const block = elementsOf([
      {
        ...ELEMENT,
        tuningChanges: [
          { from: 1, owner: word, path: "amount", to: 2 },
          { from: 0, owner: camera, path: "zoom", to: 1 },
          { from: 3, owner: word, path: "delay", to: 4 },
        ],
      },
    ]);

    expect(block).toContain(
      "Requested changes on WordPush (components/WordPush.tsx:243):\n- amount: 1 → 2\n- delay: 3 → 4\nRequested changes on CameraRig (src/videos/vidrush/CameraRig.tsx:12):\n- zoom: 0 → 1"
    );
  });

  it("names the component alone when the owner has no source location", () => {
    expect(
      elementsOf([
        {
          ...ELEMENT,
          tuningChanges: [
            {
              from: 1,
              owner: {
                component: "WordPush",
                file: null,
                line: null,
                name: null,
              },
              path: "amount",
              to: 2,
            },
          ],
        },
      ])
    ).toContain("Requested changes on WordPush:\n- amount: 1 → 2");
  });

  it("falls back to the flat heading for a stored turn whose changes carry no owner", () => {
    const block = elementsOf([
      {
        ...ELEMENT,
        tuningChanges: [
          { from: 1, path: "amount", to: 2 },
          {
            from: 0,
            owner: {
              component: "CameraRig",
              file: null,
              line: null,
              name: null,
            },
            path: "zoom",
            to: 1,
          },
        ],
      },
    ]);

    expect(block).toContain(
      "Requested changes:\n- amount: 1 → 2\nRequested changes on CameraRig:\n- zoom: 0 → 1"
    );
  });
});

describe("a from value that was read off the frame", () => {
  it("says so, and says what to change instead", () => {
    expect(
      elementsOf([
        {
          ...ELEMENT,
          tuningChanges: [
            { from: 0.42, path: "style.opacity", sampled: true, to: 1 },
          ],
        },
      ])
    ).toContain(
      "- style.opacity: 0.42 (runtime value at frame 42, animated in code; change the landing value, not the frame) → 1"
    );
  });

  it("leaves a value that was read from code alone", () => {
    expect(
      elementsOf([
        { ...ELEMENT, tuningChanges: [{ from: 12, path: "amount", to: 20 }] },
      ])
    ).toContain("- amount: 12 → 20");
  });
});
