"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Exporting } from "@/hooks/use-export";
import { ExportDialog } from "./export-dialog";

export function ExportButton({
  composition = null,
  exporting,
  renderDialog = true,
}: {
  readonly composition?: string | null;
  readonly exporting: Exporting;
  readonly renderDialog?: boolean;
}) {
  const { brief } = exporting;

  if (!exporting.isRunning || brief === null) {
    return (
      <>
        <Button
          aria-disabled={!exporting.canExport}
          className="min-w-22 aria-disabled:opacity-50"
          onClick={exporting.open}
          size="sm"
          title={
            exporting.unavailable ??
            "Pick a format and a place to save, then render"
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Export
        </Button>
        {renderDialog ? <ExportDialog composition={composition} exporting={exporting} /> : null}
      </>
    );
  }

  return (
    <Button
      aria-label="Cancel the export"
      className="relative min-w-22 overflow-hidden"
      onClick={exporting.cancel}
      size="sm"
      title={exporting.status ?? undefined}
      variant="outline"
    >
      {brief.percent === null ? null : (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-300 ease-out"
          style={{ width: `${brief.percent}%` }}
        />
      )}
      {brief.percent === null ? (
        <Spinner
          aria-hidden="true"
          className="size-4"
          data-icon="inline-start"
        />
      ) : (
        <XIcon data-icon="inline-start" />
      )}
      <span className="tabular-nums">{brief.label}</span>
    </Button>
  );
}
