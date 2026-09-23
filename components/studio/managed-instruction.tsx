"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { VERBATIM_INPUT } from "@/lib/studio/text-input";
import { DOCK_ACTIONS, DOCK_INSET, DOCK_SURFACE } from "./dock-layout";

export function ManagedInstruction({
  objectId,
  onAdd,
}: {
  objectId: string;
  onAdd: (instruction: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const value = drafts[objectId] ?? "";
  const change = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const text = event.target.value;
      setDrafts((previous) => ({ ...previous, [objectId]: text }));
    },
    [objectId]
  );
  const add = useCallback(() => {
    if (!value.trim()) {
      return;
    }
    onAdd(value.trim());
    setDrafts((previous) => ({ ...previous, [objectId]: "" }));
  }, [onAdd, objectId, value]);
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        add();
      }
    },
    [add]
  );
  return (
    <div className={DOCK_INSET}>
      <InputGroup className={DOCK_SURFACE}>
        <InputGroupTextarea
          {...VERBATIM_INPUT}
          aria-label="What should change about this element?"
          className="max-h-32 flex-1 resize-none text-sm"
          onChange={change}
          onKeyDown={keyDown}
          placeholder="What should AI change?"
          rows={2}
          value={value}
        />
        <InputGroupAddon align="block-end">
          <div className={DOCK_ACTIONS}>
            <div className="ms-auto">
              <Button disabled={!value.trim()} onClick={add} size="sm">
                Add to chat
              </Button>
            </div>
          </div>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
