import { afterEach, describe, expect, it } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProjectSettings } from "./use-project-settings";
import { useSettingsView } from "./use-settings-view";

afterEach(clearMocks);
describe("project settings drafts", () => {
  it("pins the selected project and blocks leaving until the draft is resolved", () => {
    const { result, rerender } = renderHook(({ id }) => useSettingsView(id), {
      initialProps: { id: "one" },
    });
    act(() => result.current.openProject("one"));
    act(() => result.current.setProjectDirty(true));
    rerender({ id: "two" });
    act(() => {
      result.current.openProject("two");
      result.current.close();
      result.current.setSection("appearance");
    });
    expect(result.current.projectId).toBe("one");
    expect(result.current.section).toBe("project");
    expect(result.current.isOpen).toBe(true);
    expect(result.current.blocked).toBe(true);
    act(() => {
      result.current.setProjectDirty(false);
      result.current.openProject("two");
    });
    expect(result.current.projectId).toBe("two");
    expect(result.current.blocked).toBe(false);
  });
  it("saves only the bound project and expected revision, retaining the draft on conflict", async () => {
    const requests: unknown[] = [];
    mockIPC((command, args) => {
      if (
        command !== "sidecar_request" ||
        !args ||
        Array.isArray(args) ||
        args instanceof ArrayBuffer
      ) {
        return null;
      }
      const request = args as { method: string; params: unknown };
      if (request.method === "project.settingsGet") {
        return {
          brand: null,
          name: "Original",
          projectId: "one",
          revision: 7,
          schemaVersion: 1,
        };
      }
      if (request.method === "project.settingsSave") {
        requests.push(request.params);
        return Promise.reject("Settings changed elsewhere");
      }
      return null;
    });
    const { result } = renderHook(() =>
      useProjectSettings("one", () => undefined)
    );
    await waitFor(() => expect(result.current.draft?.revision).toBe(7));
    act(() =>
      result.current.setDraft((draft) =>
        draft ? { ...draft, name: "New name" } : draft
      )
    );
    await act(() => result.current.save());
    expect(requests).toEqual([
      { brand: null, expectedRevision: 7, name: "New name", projectId: "one" },
    ]);
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft?.name).toBe("New name");
    expect(result.current.error).toContain("changed elsewhere");
    act(() => result.current.cancel());
    expect(result.current.draft?.name).toBe("Original");
  });
});
