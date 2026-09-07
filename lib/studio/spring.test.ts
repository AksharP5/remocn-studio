import { describe, expect, it } from "vitest";
import type { TuningField } from "@/lib/studio/preview";
import { paneRows, springsIn } from "@/lib/studio/spring";

function field(path: string, value: TuningField["value"]): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Parameters",
    label: path,
    max: null,
    maxLength: null,
    min: null,
    minLength: null,
    newItemDefault: null,
    options: [],
    path,
    step: null,
    targetId: "target-1",
    type: "number",
    value,
  };
}

describe("springsIn", () => {
  it("reads the triple the conventions ask for", () => {
    expect(
      springsIn([
        field("spring.damping", 20),
        field("spring.stiffness", 180),
        field("spring.mass", 1.4),
      ])
    ).toEqual([
      {
        damping: 20,
        fields: ["spring.damping", "spring.stiffness", "spring.mass"],
        label: "Spring",
        mass: 1.4,
        prefix: "spring",
        stiffness: 180,
      },
    ]);
  });

  // Mass is the one member a component may leave out: Remotion defaults it.
  it("takes a pair without a mass, at Remotion's own default", () => {
    expect(springsIn([field("damping", 12), field("stiffness", 200)])).toEqual([
      {
        damping: 12,
        fields: ["damping", "stiffness"],
        label: "Spring",
        mass: 1,
        prefix: "",
        stiffness: 200,
      },
    ]);
  });

  it("keeps two springs of one component apart", () => {
    expect(
      springsIn([
        field("entry.spring.damping", 10),
        field("entry.spring.stiffness", 100),
        field("exitSpring.damping", 30),
        field("exitSpring.stiffness", 300),
      ]).map((spring) => [spring.prefix, spring.label])
    ).toEqual([
      ["entry.spring", "Entry spring"],
      ["exitSpring", "Exit spring"],
    ]);
  });

  it("is not a spring without both numbers", () => {
    expect(springsIn([field("spring.damping", 20)])).toEqual([]);
    expect(
      springsIn([field("spring.damping", "x"), field("spring.stiffness", 180)])
    ).toEqual([]);
  });
});

describe("paneRows", () => {
  it("leads the triple, wherever in the section it starts", () => {
    const fields = [
      field("blur", 4),
      field("spring.stiffness", 180),
      field("spring.damping", 20),
    ];

    expect(
      paneRows(fields).map((row) =>
        row.kind === "spring" ? `spring:${row.spring.prefix}` : row.field.path
      )
    ).toEqual(["blur", "spring:spring", "spring.stiffness", "spring.damping"]);
  });

  it("changes nothing about a section with no spring in it", () => {
    const fields = [field("blur", 4), field("delay", 8)];

    expect(paneRows(fields).map((row) => row.kind)).toEqual(["field", "field"]);
  });
});
