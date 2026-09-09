"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectSettings, saveProjectSettings } from "@/lib/studio/projects";
import type { ProjectConfig } from "@/shared/project-config";
import { useAsyncAction } from "./use-async-action";

export function useProjectSettings(
  projectId: string,
  onSaved: () => void,
  projectPath?: string
) {
  const [saved, setSaved] = useState<ProjectConfig | null>(null);
  const [draft, setDraft] = useState<ProjectConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const currentPath = useRef(projectPath);
  currentPath.current = projectPath;
  const busy = useRef(false);
  const { run, error } = useAsyncAction();
  useEffect(() => {
    let live = true;
    const requestedPath = projectPath;
    run(getProjectSettings(projectId)).then((value) => {
      if (live && value !== null && requestedPath === currentPath.current) {
        setSaved(value);
        setDraft(value);
      }
    });
    return () => {
      live = false;
    };
  }, [projectId, run, projectPath]);
  const save = useCallback(async () => {
    if (!draft || busy.current) {
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      const next = await run(
        saveProjectSettings({
          brand: draft.brand,
          expectedRevision: draft.revision,
          name: draft.name,
          projectId,
        })
      );
      if (next) {
        setSaved(next);
        setDraft(next);
        onSaved();
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [draft, projectId, run, onSaved]);
  return {
    cancel: () => setDraft(saved),
    dirty: JSON.stringify(saved) !== JSON.stringify(draft),
    draft,
    error,
    save,
    saving,
    setDraft,
  };
}
