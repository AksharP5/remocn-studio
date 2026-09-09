"use client";

import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/hooks/use-async-action";
import { addBrandFile, importGoogleFont } from "@/lib/studio/projects";
import { type BrandFile, emptyBrand, type ProjectBrand } from "@/shared/brand";
import { DialKitSurface } from "./dialkit-surface";
import { ProjectBrandColor } from "./project-brand-color";
import { ProjectDesignImport } from "./project-design-import";
import {
  ProjectSettingsGroup,
  ProjectSettingsRow,
} from "./project-settings-group";

const FONT_ROLES = ["display", "body", "mono"] as const;
const LOGO_ROLES = ["onLight", "onDark", "mark"] as const;
type FontRole = (typeof FONT_ROLES)[number];
type LogoRole = (typeof LOGO_ROLES)[number];
const isFontRole = (value: string): value is FontRole =>
  FONT_ROLES.some((role) => role === value);
const isLogoRole = (value: string): value is LogoRole =>
  LOGO_ROLES.some((role) => role === value);

export function ProjectBrandEditor({
  value,
  onChange,
  onBusyChange,
  projectId,
  root,
}: {
  value: ProjectBrand | null;
  onChange: (brand: ProjectBrand | null) => void;
  onBusyChange: (busy: boolean) => void;
  projectId: string;
  root: string;
}) {
  const brand = value ?? emptyBrand();
  const { run, error } = useAsyncAction();
  const [fileError, setFileError] = useState<string | null>(null);
  const [colorName, setColorName] = useState("");
  const [weights, setWeights] = useState("400;700");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    onBusyChange(loading || importing);
    return () => onBusyChange(false);
  }, [loading, importing, onBusyChange]);
  const update = useCallback(
    (patch: Partial<ProjectBrand>) => onChange({ ...brand, ...patch }),
    [brand, onChange]
  );
  const changeColorName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setColorName(event.currentTarget.value),
    []
  );
  const addColor = useCallback(() => {
    const name = colorName.trim();
    if (!name || Object.hasOwn(brand.colors, name)) {
      return;
    }
    update({ colors: { ...brand.colors, [name]: "#808080" } });
    setColorName("");
  }, [brand.colors, colorName, update]);
  const changeColor = useCallback(
    (role: string, color: string) => {
      update({ colors: { ...brand.colors, [role]: color } });
    },
    [brand.colors, update]
  );
  const clear = useCallback(() => onChange(null), [onChange]);
  const changeWeights = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setWeights(event.target.value),
    []
  );
  const imageError = useCallback(
    () =>
      setFileError(
        "A logo could not be previewed. Check its file before saving."
      ),
    []
  );
  const changeText = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const [kind, role, index, field] = event.currentTarget.name.split(":");
      const text = event.currentTarget.value;
      if (kind === "name" || kind === "motion" || kind === "logoRules") {
        update({ [kind]: text });
        return;
      }
      if (kind === "tone") {
        update({ tone: { ...brand.tone, [role]: text } });
        return;
      }
      if (kind === "color") {
        const colors = { ...brand.colors };
        if (text) {
          colors[role] = text;
        } else {
          delete colors[role];
        }
        update({ colors });
        return;
      }
      if (!isFontRole(role)) {
        return;
      }
      const font = brand.typography[role] ?? {
        fallback: "sans-serif",
        family: "Custom font",
        files: [],
        licenses: [],
      };
      if (kind === "font") {
        update({
          typography: {
            ...brand.typography,
            [role]: { ...font, [index]: text },
          },
        });
        return;
      }
      if (kind === "face") {
        update({
          typography: {
            ...brand.typography,
            [role]: {
              ...font,
              files: font.files.map((file, i) =>
                i === Number(index) ? { ...file, [field]: text } : file
              ),
            },
          },
        });
      }
    },
    [brand, update]
  );
  const chooseFile = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const [kind, role] = event.currentTarget.value.split(":");
      setLoading(true);
      try {
        const extensions =
          kind === "font" ? ["woff2", "woff", "ttf", "otf"] : ["txt"];
        const path = await open({
          filters: [
            {
              extensions:
                kind === "logo" ? ["svg", "png", "jpg", "webp"] : extensions,
              name: "Brand file",
            },
          ],
          multiple: false,
          title: "Choose a brand file",
        });
        if (!path) {
          return;
        }
        const file = await run(addBrandFile(projectId, path));
        if (!file) {
          return;
        }
        if (kind === "logo" && isLogoRole(role)) {
          update({ logos: { ...brand.logos, [role]: file } });
          return;
        }
        if (!isFontRole(role)) {
          return;
        }
        const font = brand.typography[role] ?? {
          fallback: "sans-serif",
          family: file.font?.family ?? "Custom font",
          files: [],
          licenses: [],
        };
        const next =
          kind === "license"
            ? { ...font, licenses: [...font.licenses, file] }
            : {
                ...font,
                files: [...font.files, fontFace(file)],
              };
        update({ typography: { ...brand.typography, [role]: next } });
        setFileError(null);
      } catch (cause) {
        setFileError(String(cause));
      } finally {
        setLoading(false);
      }
    },
    [brand, projectId, run, update]
  );
  const downloadFont = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const [role, style] = event.currentTarget.value.split(":");
      if (!isFontRole(role)) {
        return;
      }
      const font = brand.typography[role];
      if (!font) {
        return;
      }
      setLoading(true);
      try {
        const result = await run(
          importGoogleFont(projectId, font.family, weights, style === "italic")
        );
        if (result) {
          update({
            typography: {
              ...brand.typography,
              [role]: {
                ...result,
                files: [
                  ...font.files.filter(
                    (file) =>
                      !result.files.some((next) => next.hash === file.hash)
                  ),
                  ...result.files,
                ],
                licenses: font.licenses,
              },
            },
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [brand, projectId, run, update, weights]
  );
  const removeFile = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const [kind, role, index] = event.currentTarget.value.split(":");
      if (kind === "logo" && isLogoRole(role)) {
        const logos = { ...brand.logos };
        delete logos[role];
        update({ logos });
        return;
      }
      if (!isFontRole(role)) {
        return;
      }
      const typography = { ...brand.typography };
      const font = typography[role];
      if (!font) {
        return;
      }
      if (kind === "font") {
        delete typography[role];
      } else {
        typography[role] = {
          ...font,
          files: font.files.filter((_file, i) => i !== Number(index)),
        };
      }
      update({ typography });
    },
    [brand, update]
  );
  return (
    <fieldset className="grid min-w-0 gap-10" disabled={loading}>
      <legend className="sr-only">Brand settings</legend>
      <ProjectDesignImport
        onBusyChange={setImporting}
        onChange={onChange}
        projectId={projectId}
        value={value}
      />
      <ProjectSettingsGroup
        description="Used for new videos. Existing videos keep their current appearance."
        title="Brand identity"
      >
        <ProjectSettingsRow
          description="The product or brand featured in your videos."
          htmlFor="brand-name"
          title="Brand name"
        >
          <Input
            className="max-w-full sm:w-60"
            id="brand-name"
            name="name"
            onChange={changeText}
            value={brand.name ?? ""}
          />
        </ProjectSettingsRow>
        <div className="py-4">
          <div className="mb-4 grid gap-1">
            <h4 className="text-sm">Colors</h4>
            <p className="text-muted-foreground text-xs">
              The core palette for your videos.
            </p>
          </div>
          <DialKitSurface targetId={`project-brand-colors-${projectId}`}>
            {[
              ...new Set([
                "background",
                "foreground",
                "accent",
                ...Object.keys(brand.colors),
              ]),
            ].map((role) => (
              <ProjectBrandColor
                key={role}
                onChange={changeColor}
                role={role}
                value={brand.colors[role]}
              />
            ))}
          </DialKitSurface>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Label className="grid flex-1 gap-2 text-sm">
              Additional color name
              <Input onChange={changeColorName} value={colorName} />
            </Label>
            <Button
              disabled={!colorName.trim()}
              onClick={addColor}
              type="button"
              variant="outline"
            >
              Add color
            </Button>
          </div>
        </div>
        <div className="py-4">
          <div className="mb-4 grid gap-1">
            <h4 className="text-sm">Logos</h4>
            <p className="text-muted-foreground text-xs">
              Variants for light backgrounds, dark backgrounds and small
              placements.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LOGO_ROLES.map((role) => (
              <div className="grid gap-2" key={role}>
                <span className="text-sm">
                  {
                    {
                      mark: "Brand mark",
                      onDark: "On dark",
                      onLight: "On light",
                    }[role]
                  }
                </span>
                <div
                  className="flex h-24 items-center justify-center rounded border p-3"
                  style={{
                    background: role === "onDark" ? "#181818" : "#ffffff",
                  }}
                >
                  {brand.logos[role] ? (
                    <Image
                      alt={`${role} logo preview`}
                      className="max-h-full max-w-full object-contain"
                      height={80}
                      onError={imageError}
                      src={convertFileSrc(`${root}/${brand.logos[role].path}`)}
                      unoptimized
                      width={160}
                    />
                  ) : (
                    <span className="text-neutral-500 text-xs">No logo</span>
                  )}
                </div>
                <Button
                  onClick={chooseFile}
                  type="button"
                  value={`logo:${role}`}
                  variant="outline"
                >
                  Choose…
                </Button>
                {brand.logos[role] ? (
                  <Button
                    onClick={removeFile}
                    type="button"
                    value={`logo:${role}`}
                    variant="ghost"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="py-4">
          <BrandPreview brand={brand} root={root} />
        </div>
      </ProjectSettingsGroup>
      <ProjectSettingsGroup
        description="Choose a font for each role. Expand a row to manage files, styles and licenses."
        title="Typography"
      >
        {FONT_ROLES.map((role) => {
          const font = brand.typography[role];
          return (
            <details className="group min-w-0" key={role}>
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm outline-offset-4 [&::-webkit-details-marker]:hidden">
                <span>
                  {
                    {
                      body: "Body text",
                      display: "Headings",
                      mono: "Code & numbers",
                    }[role]
                  }
                </span>
                <span className="flex min-w-0 items-center gap-3 text-muted-foreground">
                  <span className="truncate">{font?.family || "Not set"}</span>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 group-open:rotate-180"
                  />
                </span>
              </summary>
              <div className="grid gap-4 pb-5">
                <Label className="grid gap-2 text-sm capitalize">
                  {role} font
                  <Input
                    name={`font:${role}:family`}
                    onChange={changeText}
                    placeholder="Not set"
                    value={font?.family ?? ""}
                  />
                </Label>
                {font ? (
                  <Label className="grid gap-1 text-sm">
                    Fallback
                    <Input
                      name={`font:${role}:fallback`}
                      onChange={changeText}
                      value={font.fallback}
                    />
                  </Label>
                ) : null}
                <Label className="grid gap-2 text-sm">
                  Download weights
                  <Input
                    onChange={changeWeights}
                    placeholder="400;700 or 100..900"
                    value={weights}
                  />
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={chooseFile}
                    type="button"
                    value={`font:${role}`}
                    variant="outline"
                  >
                    Add font file…
                  </Button>
                  <Button
                    disabled={!font?.family}
                    onClick={downloadFont}
                    type="button"
                    value={role}
                    variant="outline"
                  >
                    Download from Google Fonts
                  </Button>
                  <Button
                    disabled={!font?.family}
                    onClick={downloadFont}
                    type="button"
                    value={`${role}:italic`}
                    variant="outline"
                  >
                    Download italic
                  </Button>
                </div>
                {font?.files.map((file, index) => (
                  <div
                    className="grid gap-3 rounded-lg bg-background/60 p-3 text-sm"
                    key={file.path}
                  >
                    <span className="break-all">
                      {file.path.split("/").at(-1)}
                    </span>
                    <span className="break-all text-muted-foreground text-xs">
                      Source: {file.source ?? "Local file"}
                    </span>
                    <Label>
                      Weight or variable range
                      <Input
                        name={`face:${role}:${index}:weight`}
                        onChange={changeText}
                        value={file.weight}
                      />
                    </Label>
                    <Label>
                      Style
                      <select
                        className="ml-2 rounded border p-2"
                        name={`face:${role}:${index}:style`}
                        onChange={changeText}
                        value={file.style}
                      >
                        <option>normal</option>
                        <option>italic</option>
                        <option>oblique</option>
                      </select>
                    </Label>
                    <Button
                      onClick={removeFile}
                      type="button"
                      value={`face:${role}:${index}`}
                      variant="ghost"
                    >
                      Remove file
                    </Button>
                  </div>
                ))}
                {font ? (
                  <>
                    <div className="flex gap-2">
                      <Button
                        onClick={chooseFile}
                        type="button"
                        value={`license:${role}`}
                        variant="ghost"
                      >
                        Add license file…
                      </Button>
                      <Button
                        onClick={removeFile}
                        type="button"
                        value={`font:${role}`}
                        variant="ghost"
                      >
                        Clear font
                      </Button>
                    </div>
                    {font.licenses.map((file) => (
                      <p
                        className="break-all text-muted-foreground text-xs"
                        key={file.path}
                      >
                        License: {file.path.split("/").at(-1)}
                      </p>
                    ))}
                  </>
                ) : null}
                {font && font.files.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No local files. Add the required styles for portable
                    rendering.
                  </p>
                ) : null}
              </div>
            </details>
          );
        })}
      </ProjectSettingsGroup>
      <ProjectSettingsGroup
        description="Guide the wording, logo placement and movement in your videos."
        title="Voice & guidelines"
      >
        {(["description", "preferred", "avoided"] as const).map((key) => (
          <ProjectSettingsRow
            htmlFor={`brand-tone-${key}`}
            key={key}
            title={
              {
                avoided: "Wording to avoid",
                description: "Tone of voice",
                preferred: "Preferred wording",
              }[key]
            }
          >
            <Textarea
              className="min-h-20 max-w-full sm:w-72"
              id={`brand-tone-${key}`}
              name={`tone:${key}`}
              onChange={changeText}
              value={brand.tone[key]}
            />
          </ProjectSettingsRow>
        ))}
        <ProjectSettingsRow htmlFor="brand-logo-rules" title="Logo usage rules">
          <Textarea
            className="min-h-20 max-w-full sm:w-72"
            id="brand-logo-rules"
            name="logoRules"
            onChange={changeText}
            value={brand.logoRules ?? ""}
          />
        </ProjectSettingsRow>
        <ProjectSettingsRow htmlFor="brand-motion" title="Motion character">
          <Textarea
            className="min-h-20 max-w-full sm:w-72"
            id="brand-motion"
            name="motion"
            onChange={changeText}
            value={brand.motion ?? ""}
          />
        </ProjectSettingsRow>
      </ProjectSettingsGroup>
      <ProjectSettingsGroup title="Brand management">
        <ProjectSettingsRow
          description="Remove the brand settings from this project."
          title="Clear brand"
        >
          <Button
            disabled={!value}
            onClick={clear}
            type="button"
            variant="ghost"
          >
            Clear brand
          </Button>
        </ProjectSettingsRow>
        {brand.provenance.length ? (
          <details className="group">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-muted-foreground text-sm outline-offset-4 [&::-webkit-details-marker]:hidden">
              <span>Imported sources</span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 shrink-0 group-open:rotate-180"
              />
            </summary>
            <div className="grid gap-2 pb-4">
              {brand.provenance.map((entry) => (
                <p
                  className="break-all text-muted-foreground text-xs"
                  key={`${entry.field}:${entry.source}`}
                >
                  {entry.field}: {entry.source}
                </p>
              ))}
            </div>
          </details>
        ) : null}
      </ProjectSettingsGroup>
      {loading ? (
        <p className="text-sm" role="status">
          Importing brand files…
        </p>
      ) : null}
      {error || fileError ? (
        <p className="text-destructive text-sm" role="alert">
          {error ?? fileError}
        </p>
      ) : null}
    </fieldset>
  );
}

function BrandPreview({ brand, root }: { brand: ProjectBrand; root: string }) {
  const [family, setFamily] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const loaded: FontFace[] = [];
    setFamily(undefined);
    setError(null);
    const font = brand.typography.display;
    if (!font) {
      return;
    }
    const name = `brand-${font.files.map((file) => file.hash).join("-")}`;
    Promise.all(
      font.files.map(async (file) => {
        const face = new FontFace(
          name,
          `url(${JSON.stringify(convertFileSrc(`${root}/${file.path}`))})`,
          {
            style: file.style,
            weight: file.weight,
            ...(file.unicodeRange ? { unicodeRange: file.unicodeRange } : {}),
          }
        );
        await face.load();
        if (alive) {
          document.fonts.add(face);
          loaded.push(face);
        }
      })
    )
      .then(() => {
        if (alive && font.files.length > 0) {
          setFamily(name);
        }
      })
      .catch(() => {
        if (alive) {
          setError("A font could not load. Preview is using the fallback.");
        }
      });
    return () => {
      alive = false;
      for (const face of loaded) {
        document.fonts.delete(face);
      }
    };
  }, [brand.typography.display, root]);
  const previewText = `Aa — ${brand.name || "Your next story"}`;
  const files = brand.typography.display?.files ?? [];
  const missing =
    files.length && files.every((file) => file.font)
      ? [
          ...new Set(
            [...previewText].filter(
              (char) =>
                char.trim() &&
                !files.some((file) =>
                  file.font?.coverage.some(([start, end]) => {
                    const code = char.codePointAt(0) ?? 0;
                    return code >= start && code <= end;
                  })
                )
            )
          ),
        ].join(" ")
      : "";
  return (
    <div
      className="min-w-0 rounded-lg border p-6"
      style={{
        background: brand.colors.background,
        color: brand.colors.foreground,
      }}
    >
      <p className="mb-3 text-xs">Preview</p>
      <p
        className="text-balance break-words text-2xl leading-tight sm:text-3xl"
        style={{ fontFamily: family ?? brand.typography.display?.fallback }}
      >
        {previewText}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(brand.colors).map(([role, color]) => (
          <span
            className="size-8 shrink-0 rounded-full border"
            key={role}
            style={{ background: color }}
            title={`${role}: ${color}`}
          />
        ))}
      </div>
      {missing ? (
        <p className="mt-3 break-words text-xs leading-relaxed" role="status">
          Missing glyphs: {missing}. These characters use the fallback.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 break-words text-xs leading-relaxed" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fontFace(file: BrandFile) {
  return {
    ...file,
    axes: file.font?.axes,
    style: file.font?.style ?? ("normal" as const),
    weight: file.font?.weight ?? "400",
  };
}
