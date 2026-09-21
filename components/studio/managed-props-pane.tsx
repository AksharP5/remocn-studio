"use client";

import { SelectControl } from "dialkit";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { ManagedObjects } from "@/hooks/use-managed-objects";
import type { PropGroups } from "@/hooks/use-prop-groups";
import { readableLabel } from "@/lib/studio/property-presentation";
import { DialKitSurface } from "./dialkit-surface";
import { ManagedFields } from "./managed-fields";
import { Pane, PaneActions, PaneBody, PaneHeader } from "./pane";

export function ManagedPropsPane({
  objects,
  groups,
  fps,
}: {
  objects: ManagedObjects;
  groups?: PropGroups;
  fps?: number;
}) {
  const [tab, setTab] = useState("appearance");
  const changeTab = useCallback(
    (value: unknown) => {
      if (objects.pending > 0) {
        objects.commit();
      }
      setTab(String(value));
    },
    [objects.commit, objects.pending]
  );
  let status = objects.canUndo ? "Saved" : "";
  if (objects.awaitingPreview) {
    status = "Updating preview…";
  }
  if (objects.pending > 0) {
    status = "Unsaved changes";
  }
  if (objects.busy) {
    status = "Saving…";
  }
  if (objects.loading) {
    status = "Loading properties…";
  }
  return (
    <Pane className="managed-inspector">
      <Tabs
        className="h-full min-h-0 gap-0"
        onValueChange={changeTab}
        value={tab}
      >
        <PaneHeader className="h-auto flex-col items-stretch gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <DialKitSurface targetId="object-picker">
              <SelectControl
                label="Element"
                onChange={objects.select}
                options={objects.objects.map((object) => ({
                  label: readableLabel(object.label),
                  value: object.id,
                }))}
                value={objects.selected?.id ?? "Choose an element"}
              />
            </DialKitSurface>
            <PaneActions>
              <Button
                aria-label="Undo last object change"
                disabled={!objects.canUndo}
                onClick={objects.undo}
                size="icon-sm"
                title="Undo last change"
                variant="ghost"
              >
                <RotateCcwIcon />
              </Button>
              <Button
                aria-label="Close object properties"
                onClick={objects.close}
                size="icon-sm"
                title="Close properties"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </PaneActions>
          </div>
          <div className="flex flex-col gap-2 text-xs [overflow-wrap:anywhere]">
            {status ? (
              <p className="text-muted-foreground text-xs" role="status">
                {status}
              </p>
            ) : null}
            {objects.error ? (
              <div className="grid gap-2">
                <p className="text-destructive text-xs" role="alert">
                  {objects.error}
                </p>
                <Button
                  disabled={objects.busy}
                  onClick={objects.retry}
                  size="sm"
                  variant="outline"
                >
                  Retry saving
                </Button>
                <Button onClick={objects.reload} size="sm" variant="outline">
                  Reload properties
                </Button>
              </div>
            ) : null}
            {objects.pending > 0 ? (
              <Button
                disabled={objects.busy}
                onClick={objects.discard}
                size="sm"
                variant="outline"
              >
                Discard unsaved changes
              </Button>
            ) : null}
          </div>
          <TabsList
            aria-label="Property category"
            className="w-full"
            size="sm"
            variant="default"
          >
            <TabsTab
              className="focus-visible:ring-foreground/40"
              value="appearance"
            >
              Appearance
            </TabsTab>
            <TabsTab
              className="focus-visible:ring-foreground/40"
              value="animation"
            >
              Animation
            </TabsTab>
          </TabsList>
        </PaneHeader>
        <PaneBody className="overflow-y-auto px-3 py-2">
          <TabsPanel hidden={tab !== "appearance"} value="appearance">
            <DialKitSurface targetId={objects.selected?.id ?? "objects"}>
              <ManagedFields
                fps={fps}
                groups={groups}
                key={objects.selected?.id ?? "objects"}
                objects={objects}
                tab="appearance"
              />
            </DialKitSurface>
          </TabsPanel>
          <TabsPanel hidden={tab !== "animation"} value="animation">
            <DialKitSurface targetId={objects.selected?.id ?? "objects"}>
              <ManagedFields
                fps={fps}
                groups={groups}
                key={objects.selected?.id ?? "objects"}
                objects={objects}
                tab="animation"
              />
            </DialKitSurface>
          </TabsPanel>
        </PaneBody>
      </Tabs>
    </Pane>
  );
}
