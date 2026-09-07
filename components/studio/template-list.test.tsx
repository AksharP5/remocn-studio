import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateList } from "@/components/studio/template-list";
import { PROMPT_TEMPLATES } from "@/lib/studio/templates";

describe("TemplateList", () => {
  it("shows a row per template", () => {
    render(<TemplateList onPick={mock()} />);

    for (const template of PROMPT_TEMPLATES) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${template.title}`) })
      ).toBeInTheDocument();
    }
  });

  it("hands over the picked template's prompt, and only that", async () => {
    const onPick = mock();
    const user = userEvent.setup();
    render(<TemplateList onPick={onPick} />);

    const [, , template] = PROMPT_TEMPLATES;
    if (template === undefined) {
      throw new Error("expected a third template");
    }
    await user.click(
      screen.getByRole("button", { name: new RegExp(`^${template.title}`) })
    );

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(template.prompt);
  });
});
