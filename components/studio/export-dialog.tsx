"use client";

import { FolderOpenIcon, TriangleAlertIcon } from "lucide-react";
import { MiddleTruncation } from "@/components/middle-truncation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Exporting } from "@/hooks/use-export";
import { VERBATIM_INPUT } from "@/lib/studio/text-input";
import { cn } from "@/lib/utils";
import {
  EXPORT_FORMATS,
  EXPORT_PRESETS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
  type ExportPreset,
  FORMAT_SPECS,
  PRESET_SPECS,
  QUALITY_LABELS,
  RESOLUTION_LABELS,
} from "@/shared/export";

import { SettingsGroup, SettingsPanel } from "./settings-group";

const NAME_FIELD = "export-file-name";

export function ExportDialog({
  composition,
  exporting,
}: {
  readonly composition: string | null;
  readonly exporting: Exporting;
}) {
  const { review, settings } = exporting;
  const spec = FORMAT_SPECS[settings.format];

  return (
    <Dialog onOpenChange={exporting.close} open={exporting.isOpen}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="max-h-[calc(100dvh-2rem)] max-w-4xl"
        closeProps={{ className: "absolute end-2 top-2 size-10" }}
      >
        <DialogHeader className="shrink-0 pr-14">
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription className="break-words">
            {composition === null
              ? "Rendered by this project’s own Remotion."
              : `${composition}, rendered by this project’s own Remotion.`}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="grid min-w-0 gap-6" scrollFade={false}>
          <SettingsPanel
            description="Presets keep the video’s shape. Changing a setting switches to Custom."
            title="Start from"
          >
            <Choice
              label="Start from"
              onChange={exporting.choosePreset}
              options={EXPORT_PRESETS.map((preset) => ({
                label: presetLabel(preset),
                value: preset,
              }))}
              value={settings.preset}
            />
          </SettingsPanel>

          <SettingsGroup title="Video">
            <Setting
              label="Format"
              name="export-format"
              onChange={exporting.chooseFormat}
              options={EXPORT_FORMATS.map((format) => ({
                label: FORMAT_SPECS[format].label,
                value: format,
              }))}
              value={settings.format}
            />

            <Setting
              label="Resolution"
              name="export-resolution"
              onChange={exporting.chooseResolution}
              options={EXPORT_RESOLUTIONS.map((resolution) => ({
                label: RESOLUTION_LABELS[resolution],
                value: resolution,
              }))}
              value={settings.resolution}
            />

            {spec.quality === null ? null : (
              <Setting
                label="Quality"
                name="export-quality"
                onChange={exporting.chooseQuality}
                options={EXPORT_QUALITIES.map((quality) => ({
                  label: QUALITY_LABELS[quality],
                  value: quality,
                }))}
                value={settings.quality}
              />
            )}
          </SettingsGroup>

          <SettingsPanel
            description="Exporting again replaces the file at this location."
            title="Save to"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor={NAME_FIELD}>File name</Label>
                <InputGroup>
                  <Input
                    autoComplete="off"
                    className="h-11 sm:h-10"
                    data-1p-ignore
                    data-lpignore="true"
                    id={NAME_FIELD}
                    onChange={exporting.rename}
                    spellCheck="false"
                    value={exporting.fileName}
                    {...VERBATIM_INPUT}
                  />
                </InputGroup>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label id="export-folder-label" render={<span />}>
                  Folder
                </Label>
                <Button
                  aria-labelledby="export-folder-label export-folder-path"
                  className="h-11 w-full min-w-0 justify-start font-normal text-muted-foreground sm:h-10"
                  id="export-folder"
                  onClick={exporting.chooseFolder}
                  type="button"
                  variant="outline"
                >
                  <FolderOpenIcon data-icon="inline-start" />
                  <MiddleTruncation
                    className="min-w-0 flex-1 text-left"
                    ellipsis="…"
                    id="export-folder-path"
                  >
                    {exporting.folder}
                  </MiddleTruncation>
                </Button>
              </div>
            </div>
          </SettingsPanel>

          {review.problems.length > 0 || review.warnings.length > 0 ? (
            <div className="grid min-w-0 gap-2 px-4" role="status">
              {review.problems.map((problem) => (
                <Notice key={problem} tone="problem">
                  {problem}
                </Notice>
              ))}
              {review.warnings.map((warning) => (
                <Notice key={warning} tone="warning">
                  {warning}
                </Notice>
              ))}
            </div>
          ) : null}
        </DialogPanel>

        <DialogFooter className="shrink-0 flex-col gap-3 sm:items-center sm:justify-between">
          <Summary exporting={exporting} />
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              className="h-11 sm:h-10"
              onClick={exporting.close}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              aria-disabled={review.problems.length > 0}
              className="h-11 aria-disabled:opacity-50 sm:h-10"
              onClick={exporting.render}
            >
              Export
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function Summary({ exporting }: { readonly exporting: Exporting }) {
  const { review, settings } = exporting;
  const spec = FORMAT_SPECS[settings.format];
  const sized =
    review.output.width > 0
      ? `${review.output.width}×${review.output.height}`
      : null;

  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      {sized === null ? null : (
        <span className="font-medium tabular-nums">{sized}</span>
      )}
      <span className="text-muted-foreground">{spec.container}</span>
      {exporting.duration === null ? null : (
        <span className="text-muted-foreground tabular-nums">
          {exporting.duration}
        </span>
      )}
    </p>
  );
}

function presetLabel(preset: ExportPreset): string {
  return preset === "custom" ? "Custom" : PRESET_SPECS[preset].label;
}

function Notice({
  children,
  tone,
}: {
  readonly children: string;
  readonly tone: "problem" | "warning";
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-pretty text-xs/relaxed",
        tone === "problem" ? "text-destructive" : "text-muted-foreground"
      )}
    >
      <TriangleAlertIcon
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0"
      />
      {children}
    </p>
  );
}

function Setting({
  label,
  name,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly name: string;
  readonly onChange: (value: unknown) => void;
  readonly options: readonly { label: string; value: string }[];
  readonly value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-sm leading-none sm:w-24 sm:shrink-0" id={name}>
        {label}
      </span>
      <Choice
        label={label}
        onChange={onChange}
        options={options}
        value={value}
      />
    </div>
  );
}

function Choice({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: unknown) => void;
  readonly options: readonly { label: string; value: string }[];
  readonly value: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap"
      onValueChange={onChange}
      value={value}
    >
      {options.map((option) => (
        <Label
          className="min-h-11 min-w-0 cursor-pointer justify-center rounded-md border bg-card px-3 py-2 text-center font-normal text-sm leading-snug transition-colors hover:bg-accent has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/8 has-[[data-checked]]:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foreground/60 has-[:focus-visible]:outline-offset-2 sm:min-h-10 sm:flex-1"
          key={option.value}
        >
          <span className="sr-only">
            <RadioGroupItem value={option.value} />
          </span>
          {option.label}
        </Label>
      ))}
    </RadioGroup>
  );
}
