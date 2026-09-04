import { convertFileSrc } from "@tauri-apps/api/core";
import {
  IMAGE_MEDIA_TYPES,
  type ImageMediaType,
  MEDIA_TYPES,
  type MediaType,
  type PromptAttachment,
  type PromptMedia,
} from "@/shared/ipc";
import { baseName } from "./paths";

const MEDIA_BY_EXTENSION: Record<string, MediaType> = {
  aac: "audio/aac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  avi: "video/x-msvideo",
  flac: "audio/flac",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  png: "image/png",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

// Pictures the studio recognises and still cannot take: the API reads jpeg,
// png, gif and webp and nothing else, so these are real refusals. What was
// wrong was the sentence — "that is not a picture" about a photograph is
// unhelpful and untrue, where naming the format and the way out is neither.
const UNSENDABLE_IMAGES: Record<string, string> = {
  avif: "AVIF",
  bmp: "BMP",
  heic: "HEIC",
  heif: "HEIF",
  svg: "SVG",
  tif: "TIFF",
  tiff: "TIFF",
};

export function unsendableImageOf(path: string): string | null {
  const name = baseName(path);
  return name.length === 0
    ? null
    : (UNSENDABLE_IMAGES[extensionOf(name)] ?? null);
}

const IMAGES = new Set<string>(IMAGE_MEDIA_TYPES);
const SUPPORTED = new Set<string>(MEDIA_TYPES);

export const MEDIA_EXTENSIONS = Object.keys(MEDIA_BY_EXTENSION);

export const IMAGE_EXTENSIONS = MEDIA_EXTENSIONS.filter((extension) =>
  IMAGES.has(MEDIA_BY_EXTENSION[extension] ?? "")
);

export const PLAYABLE_EXTENSIONS = MEDIA_EXTENSIONS.filter(
  (extension) => !IMAGES.has(MEDIA_BY_EXTENSION[extension] ?? "")
);

export function mediaOf(path: string): PromptMedia | null {
  const name = baseName(path);
  const mediaType = MEDIA_BY_EXTENSION[extensionOf(name)];

  return mediaType === undefined || name.length === 0
    ? null
    : { mediaType, name, path };
}

export function attachmentOf(path: string): PromptAttachment | null {
  const found = mediaOf(path);

  return found === null || !isImageMediaType(found.mediaType)
    ? null
    : { mediaType: found.mediaType, name: found.name, path: found.path };
}

export function isImageMediaType(value: string): value is ImageMediaType {
  return IMAGES.has(value);
}

export function isMediaType(value: string): value is MediaType {
  return SUPPORTED.has(value);
}

export function isPlayable(mediaType: MediaType): boolean {
  return !IMAGES.has(mediaType);
}

export function previewUrl(path: string): string | null {
  if (path.length === 0) {
    return null;
  }

  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}
