"use client";

import { ChevronDownIcon, FileTextIcon } from "lucide-react";
import { type ChangeEvent, type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ProjectBrand } from "@/shared/brand";
import {
  type DesignImport,
  type DesignSelection,
  selectionError,
} from "@/shared/design-import";
import { SettingsGroup } from "./settings-group";

type ImportChange = (
  event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
) => void;
const PATH_SEPARATOR = /[\\/]/;
const FONT_ROLE_ORDER = ["display", "body", "mono"] as const;
const FONT_ROLES = {
  body: "Body text",
  display: "Headings",
  mono: "Code",
} as const;

export function DesignImportReview({
  data,
  selection,
  current,
  loading,
  onChange,
  onReplace,
  onApply,
  onCancel,
}: {
  data: DesignImport;
  selection: DesignSelection;
  current: ProjectBrand | null;
  loading: boolean;
  onChange: ImportChange;
  onReplace: () => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const colors = selection.colors.filter((entry) => entry.selected);
  const fonts = selection.fonts.filter((entry) => entry.role);
  const families = [
    ...new Map(data.fonts.map((font) => [font.family, font])).values(),
  ];
  const invalid = selectionError(selection);
  return (
    <SettingsGroup
      description="Choose what to add to your brand. Existing values stay unless you select a replacement."
      title="Review design import"
    >
      <fieldset
        className="min-w-0 divide-y divide-border/60"
        disabled={loading}
      >
        <legend className="sr-only">Import selection</legend>
        <div className="flex flex-wrap items-center gap-3 py-4">
          <FileTextIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 basis-48">
            <p className="break-words text-sm">
              {data.document.file.source?.split(PATH_SEPARATOR).at(-1) ??
                "DESIGN.md"}
            </p>
            <p className="mt-1 text-muted-foreground text-xs tabular-nums">
              {selection.colors.length} colors · {families.length} font families
            </p>
          </div>
          <Button onClick={onReplace} type="button" variant="ghost">
            {loading ? "Reading…" : "Replace file"}
          </Button>
        </div>
        {data.name ? (
          <label className="flex min-h-16 cursor-pointer items-center gap-3 py-4 text-sm">
            <input
              checked={selection.name}
              className="size-4 shrink-0 accent-primary"
              name="name"
              onChange={onChange}
              type="checkbox"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-muted-foreground text-xs">
                Brand name
              </span>
              <span className="mt-1 block break-words">{data.name}</span>
            </span>
            <span className="max-w-[45%] break-words text-muted-foreground text-xs">
              {importChangeLabel(current?.name, selection.name)}
            </span>
          </label>
        ) : null}
        {selection.colors.length ? (
          <ImportDisclosure
            description={`${colors.length} of ${selection.colors.length} selected`}
            preview={
              <div aria-hidden="true" className="flex gap-1">
                {selection.colors.slice(0, 6).map((entry) => (
                  <span
                    className="size-4 rounded-sm border border-border"
                    key={entry.token}
                    style={{ background: data.colors[entry.token] }}
                  />
                ))}
              </div>
            }
            title="Colors"
          >
            <section
              aria-label="Imported colors"
              className="max-h-80 divide-y divide-border/60 overflow-y-auto overscroll-contain pe-2"
            >
              {selection.colors.map((entry, index) => (
                <ImportColorRow
                  color={data.colors[entry.token]}
                  current={current?.colors[entry.role.trim()]}
                  entry={entry}
                  index={index}
                  key={entry.token}
                  onChange={onChange}
                />
              ))}
            </section>
          </ImportDisclosure>
        ) : null}
        {families.length ? (
          <div className="py-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <h4 className="text-sm">Typography</h4>
              <span className="text-muted-foreground text-xs tabular-nums">
                {fonts.length} of 3 roles selected
              </span>
            </div>
            <div className="divide-y divide-border/60">
              {FONT_ROLE_ORDER.map((role) => {
                const selected = selection.fonts.find(
                  (entry) => entry.role === role
                );
                const family =
                  data.fonts.find((font) => font.token === selected?.token)
                    ?.family ?? "";
                const previous = current?.typography[role]?.family;
                return (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                    key={role}
                  >
                    <div className="min-w-0 flex-1 basis-32">
                      <label
                        className="text-sm"
                        htmlFor={`import-font-${role}`}
                      >
                        {FONT_ROLES[role]}
                      </label>
                      <p className="mt-1 break-words text-muted-foreground text-xs">
                        {fontChangeLabel(previous, family)}
                      </p>
                    </div>
                    <NativeSelect
                      className="w-full sm:w-64 [&_select]:truncate"
                      id={`import-font-${role}`}
                      name={`font:${role}`}
                      onChange={onChange}
                      value={family}
                    >
                      <option value="">
                        {previous ? "Keep current font" : "Do not import"}
                      </option>
                      {families.map((font) => (
                        <option key={font.family} value={font.family}>
                          {fontName(font.family)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                );
              })}
            </div>
            <ImportDisclosure
              description={`${data.fonts.length} text styles`}
              title="Found in the document"
            >
              <div className="grid gap-4">
                {families.map((font) => {
                  const matches = data.fonts.filter(
                    (item) => item.family === font.family
                  );
                  return (
                    <div className="grid gap-1" key={font.family}>
                      <p className="break-words text-sm">{font.family}</p>
                      <p className="text-muted-foreground text-xs">
                        Weights:{" "}
                        {[...new Set(matches.map((item) => item.weight))].join(
                          ", "
                        )}
                      </p>
                      <p className="break-words text-muted-foreground text-xs">
                        Used for: {matches.map((item) => item.token).join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ImportDisclosure>
          </div>
        ) : null}
        <ImportDisclosure
          description={
            data.warnings.length
              ? `${data.warnings.length} ${data.warnings.length === 1 ? "note" : "notes"} to review`
              : "Original design guidance"
          }
          title="Document & notes"
        >
          {data.warnings.length ? (
            <ul className="mb-4 grid list-disc gap-2 ps-4 text-muted-foreground text-xs leading-relaxed">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-3 text-xs leading-relaxed">
            {data.document.markdown}
          </pre>
        </ImportDisclosure>
        <div className="grid gap-3 py-4">
          <p className="text-muted-foreground text-xs leading-relaxed">
            The document will be attached as design guidance. Your explicit
            brand settings take priority. Import adds changes to the draft; save
            the project to keep them.
          </p>
          {invalid ? (
            <p className="text-destructive text-sm" role="alert">
              {invalid}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p
              className="me-auto text-muted-foreground text-xs tabular-nums"
              role="status"
            >
              {colors.length} colors · {fonts.length} font roles
              {selection.name && data.name ? " · brand name" : ""}
            </p>
            <Button onClick={onCancel} type="button" variant="ghost">
              Cancel import
            </Button>
            <Button disabled={!!invalid} onClick={onApply} type="button">
              Import into draft
            </Button>
          </div>
        </div>
      </fieldset>
    </SettingsGroup>
  );
}

function fontName(family: string) {
  return family.split(",")[0].replaceAll('"', "").replaceAll("'", "").trim();
}
function fontChangeLabel(previous: string | undefined, selected: string) {
  if (!selected) {
    return previous ? `Keeping ${fontName(previous)}` : "Not set";
  }
  if (previous === selected) {
    return "Already in use";
  }
  return previous ? `Replaces ${fontName(previous)}` : "New font";
}

function ImportDisclosure({
  title,
  description,
  preview,
  children,
}: {
  title: string;
  description: string;
  preview?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group/import min-w-0">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-4 outline-offset-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm">{title}</span>
          <span className="mt-1 block text-muted-foreground text-xs tabular-nums">
            {description}
          </span>
        </span>
        {preview}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground group-open/import:rotate-180"
        />
      </summary>
      <div className="min-w-0 pb-4">{children}</div>
    </details>
  );
}

function ImportColorRow({
  color,
  current,
  entry,
  index,
  onChange,
}: {
  color: string;
  current: string | undefined;
  entry: DesignSelection["colors"][number];
  index: number;
  onChange: ImportChange;
}) {
  const [editing, setEditing] = useState(false);
  const toggleEditing = useCallback(() => setEditing((open) => !open), []);
  return (
    <div className="grid gap-2 py-2">
      <div className="flex items-center gap-3">
        <label className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-3">
          <input
            aria-label={`${entry.token}: ${color}`}
            checked={entry.selected}
            className="size-4 shrink-0 accent-primary"
            name={`color:${index}`}
            onChange={onChange}
            type="checkbox"
          />
          <span
            aria-hidden="true"
            className="size-6 shrink-0 rounded-md border border-border"
            style={{ background: color }}
          />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm">
              {entry.role || entry.token}
            </span>
            <span className="block text-muted-foreground text-xs">
              {importChangeLabel(current, entry.selected)}
            </span>
          </span>
          <span className="shrink-0 font-mono text-muted-foreground text-xs">
            {color}
          </span>
        </label>
        <Button
          aria-expanded={editing}
          aria-label={`Edit role for ${entry.token}`}
          onClick={toggleEditing}
          size="sm"
          type="button"
          variant="ghost"
        >
          {editing ? "Done" : "Edit"}
        </Button>
      </div>
      {editing ? (
        <div className="grid gap-2 ps-7">
          <label
            className="text-muted-foreground text-xs"
            htmlFor={`import-color-${index}`}
          >
            Import as
          </label>
          <Input
            id={`import-color-${index}`}
            name={`role:${index}`}
            onChange={onChange}
            value={entry.role}
          />
          <p className="text-muted-foreground text-xs">
            Select the color again after changing its role.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function importChangeLabel(current: string | undefined, selected: boolean) {
  if (current) {
    return `${selected ? "Replaces" : "Keeps"} ${current}`;
  }
  return selected ? "New" : "Not imported";
}
