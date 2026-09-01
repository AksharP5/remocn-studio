"use client";

import { useCallback, useRef, useState } from "react";

export function useScrubEdit(): {
  done: () => void;
  edit: () => void;
  editing: boolean;
  ref: React.RefObject<HTMLInputElement | null>;
} {
  const ref = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  const edit = useCallback(() => {
    setEditing(true);
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const done = useCallback(() => {
    setEditing(false);
  }, []);

  return { done, edit, editing, ref };
}
