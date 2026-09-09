import { afterEach, expect, it, mock } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { emptyBrand } from "@/shared/brand";
import { ProjectDesignImport } from "./project-design-import";

afterEach(() => {
  cleanup();
  clearMocks();
});
function setup(
  fonts: { token: string; family: string; weight: string }[] = []
) {
  const onChange = mock();
  const onBusyChange = mock();
  const requests: string[] = [];
  mockIPC((command, args) => {
    if (command === "plugin:dialog|open") {
      return "/tmp/DESIGN.md";
    }
    if (command !== "sidecar_request") {
      return null;
    }
    const request = args as { method: string };
    requests.push(request.method);
    return {
      colors: { accent: "#ff0000" },
      document: {
        file: {
          hash: "a".repeat(64),
          path: "public/brand/test/DESIGN.md",
          source: "DESIGN.md",
        },
        markdown: "# Test",
      },
      fonts,
      name: "Imported",
      warnings: [],
    };
  });
  render(
    <ProjectDesignImport
      onBusyChange={onBusyChange}
      onChange={onChange}
      projectId="one"
      value={{
        ...emptyBrand(),
        colors: { accent: "#000000" },
        name: "Current",
      }}
    />
  );
  return { onChange, requests };
}
it("cancels a preview without modifying or saving the brand", async () => {
  const { onChange, requests } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Import DESIGN.md" }));
  await screen.findByRole("button", { name: "Cancel import" });
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
  expect(onChange).not.toHaveBeenCalled();
  expect(requests).toEqual(["project.designImport"]);
});
it("requires an explicit checkbox to replace a current color and only updates the draft", async () => {
  const { onChange, requests } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Import DESIGN.md" }));
  fireEvent.click(await screen.findByText("Colors", { selector: "span" }));
  const checkbox = await screen.findByRole("checkbox", {
    name: "accent: #ff0000",
  });
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Import into draft" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(onChange.mock.calls[0][0].colors.accent).toBe("#ff0000");
  expect(onChange.mock.calls[0][0].name).toBe("Current");
  expect(requests).toEqual(["project.designImport"]);
});

it("maps one imported family to multiple roles and preserves independent choices", async () => {
  const { onChange } = setup([
    { family: "SF Pro, sans-serif", token: "hero", weight: "700" },
    { family: "SF Pro, sans-serif", token: "body", weight: "400" },
    { family: "Menlo, monospace", token: "code", weight: "400" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Import DESIGN.md" }));
  const headings = await screen.findByRole("combobox", { name: "Headings" });
  const body = screen.getByRole("combobox", { name: "Body text" });
  const code = screen.getByRole("combobox", { name: "Code" });
  expect(screen.getAllByRole("combobox")).toHaveLength(3);
  expect((headings as HTMLSelectElement).options).toHaveLength(3);
  fireEvent.change(headings, { target: { value: "SF Pro, sans-serif" } });
  fireEvent.change(body, { target: { value: "SF Pro, sans-serif" } });
  fireEvent.change(code, { target: { value: "Menlo, monospace" } });
  fireEvent.change(headings, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Import into draft" }));
  const [[brand]] = onChange.mock.calls;
  expect(brand.typography.display).toBeUndefined();
  expect(brand.typography.body.family).toBe("SF Pro, sans-serif");
  expect(brand.typography.mono.family).toBe("Menlo, monospace");
  expect(brand.design.file.source).toBe("DESIGN.md");
});
it("keeps role editing hidden and clears selection when a destination changes", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Import DESIGN.md" }));
  fireEvent.click(await screen.findByText("Colors", { selector: "span" }));
  expect(screen.queryByRole("textbox", { name: "Import as" })).toBeNull();
  const checkbox = screen.getByRole("checkbox", { name: "accent: #ff0000" });
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Edit role for accent" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Import as" }), {
    target: { value: "background" },
  });
  expect((checkbox as HTMLInputElement).checked).toBe(false);
});
