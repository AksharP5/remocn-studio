"use client";

import SiInstagram from "@icons-pack/react-simple-icons/icons/SiInstagram";
import SiTiktok from "@icons-pack/react-simple-icons/icons/SiTiktok";
import SiYoutube from "@icons-pack/react-simple-icons/icons/SiYoutube";
import SiYoutubeshorts from "@icons-pack/react-simple-icons/icons/SiYoutubeshorts";
import {
  FolderOpenIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
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

const NAME_FIELD = "export-file-name";

const CHOICE_STYLE =
  "min-w-0 cursor-pointer justify-center rounded-lg border border-input bg-background text-center font-normal text-sm hover:bg-accent has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/8 has-[[data-checked]]:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foreground/60 has-[:focus-visible]:outline-offset-2";

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
        className="max-h-[calc(100dvh-2rem)] max-w-2xl"
        closeProps={{ className: "absolute end-2 top-2 size-10" }}
      >
        <DialogHeader className="shrink-0 gap-1 p-5 pr-14">
          <DialogTitle className="text-balance font-medium text-lg">
            Export video
          </DialogTitle>
          <DialogDescription
            className="truncate"
            title={composition ?? undefined}
          >
            {composition ?? "Choose how to save your video."}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="grid min-w-0 gap-4 p-5" scrollFade={false}>
          <section aria-labelledby="export-preset-label" className="grid gap-2">
            <h3 className="font-medium text-sm" id="export-preset-label">
              Preset
            </h3>
            <PresetChoice
              onChange={exporting.choosePreset}
              value={settings.preset}
            />
            <p className="text-pretty text-muted-foreground text-xs">
              {settings.preset === "shorts"
                ? "For Shorts, Reels and TikTok. Your video keeps its original shape."
                : "Presets keep your video’s original shape."}
            </p>
          </section>

          <section
            aria-label="Video settings"
            className="grid gap-2 border-y py-4"
          >
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
          </section>

          <section
            aria-labelledby="export-destination-label"
            className="grid min-w-0 gap-2"
          >
            <h3 className="font-medium text-sm" id="export-destination-label">
              Save to
            </h3>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <Label
                  className="font-normal text-muted-foreground text-xs"
                  htmlFor={NAME_FIELD}
                >
                  File name
                </Label>
                <InputGroup>
                  <FileNameInput
                    fileName={exporting.fileName}
                    onRename={exporting.rename}
                  />
                </InputGroup>
              </div>

              <div className="grid min-w-0 gap-1.5">
                <Label
                  className="font-normal text-muted-foreground text-xs"
                  id="export-folder-label"
                  render={<span />}
                >
                  Folder
                </Label>
                <Button
                  aria-labelledby="export-folder-label export-folder-path"
                  className="h-11 w-full min-w-0 justify-start font-normal sm:h-10"
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
                    title={exporting.folder}
                  >
                    {exporting.folder}
                  </MiddleTruncation>
                </Button>
              </div>
            </div>
            <p className="text-pretty text-muted-foreground text-xs">
              An existing file with this name will be replaced.
            </p>
          </section>

          {review.problems.length > 0 || review.warnings.length > 0 ? (
            <div className="grid min-w-0 gap-2" role="status">
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

        <DialogFooter className="shrink-0 flex-col gap-3 px-5 py-3 sm:items-center sm:justify-between">
          <Summary exporting={exporting} />
          <div className="flex shrink-0 justify-end gap-2">
            <Button onClick={exporting.close} size="sm" variant="outline">
              Cancel
            </Button>
            <Button
              aria-disabled={review.problems.length > 0}
              className="aria-disabled:opacity-50"
              onClick={exporting.render}
              size="sm"
            >
              Export
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function FileNameInput({
  fileName,
  onRename,
}: {
  fileName: string;
  onRename: Exporting["rename"];
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft(event.currentTarget.value);
      onRename(event);
    },
    [onRename]
  );
  const onBlur = useCallback(() => setDraft(null), []);

  return (
    <Input
      autoComplete="off"
      className="h-11 sm:h-10"
      data-1p-ignore
      data-lpignore="true"
      id={NAME_FIELD}
      name="fileName"
      onBlur={onBlur}
      onChange={onChange}
      spellCheck="false"
      value={draft ?? fileName}
      {...VERBATIM_INPUT}
    />
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
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm tabular-nums">
      {sized === null ? null : (
        <span className="font-medium tabular-nums">{sized}</span>
      )}
      {sized === null ? null : (
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
      )}
      <span className="text-muted-foreground">{spec.container}</span>
      {exporting.duration === null ? null : (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground tabular-nums">
            {exporting.duration}
          </span>
        </>
      )}
    </p>
  );
}

function presetLabel(preset: ExportPreset): string {
  return preset === "custom" ? "Custom" : PRESET_SPECS[preset].label;
}

function PresetIcons({ preset }: { preset: ExportPreset }) {
  if (preset === "youtube") {
    return <SiYoutube className="size-4 shrink-0" />;
  }
  if (preset === "instagram") {
    return <SiInstagram className="size-4 shrink-0" />;
  }
  if (preset === "shorts") {
    return (
      <>
        <SiYoutubeshorts className="size-4 shrink-0" />
        <SiInstagram className="size-4 shrink-0" />
        <SiTiktok className="size-4 shrink-0" />
      </>
    );
  }
  return <SlidersHorizontalIcon className="size-4 shrink-0" />;
}

function PresetChoice({
  onChange,
  value,
}: {
  onChange: Exporting["choosePreset"];
  value: ExportPreset;
}) {
  return (
    <RadioGroup
      aria-labelledby="export-preset-label"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      onValueChange={onChange}
      value={value}
    >
      {EXPORT_PRESETS.map((preset) => (
        <Label
          className={cn(CHOICE_STYLE, "min-h-16 flex-col gap-2 px-2 py-2.5")}
          key={preset}
        >
          <span className="sr-only">
            <RadioGroupItem value={preset} />
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none flex h-4 items-center gap-2 text-muted-foreground"
          >
            <PresetIcons preset={preset} />
          </span>
          {preset === "shorts" ? (
            <>
              <span aria-hidden="true">Short video</span>
              <span className="sr-only">{presetLabel(preset)}</span>
            </>
          ) : (
            presetLabel(preset)
          )}
        </Label>
      ))}
    </RadioGroup>
  );
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
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <p
        className="text-muted-foreground text-sm sm:w-20 sm:shrink-0"
        id={name}
      >
        {label}
      </p>
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
      className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4"
      onValueChange={onChange}
      value={value}
    >
      {options.map((option) => (
        <Label
          className={cn(CHOICE_STYLE, "min-h-11 px-2 py-2 sm:min-h-10")}
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
