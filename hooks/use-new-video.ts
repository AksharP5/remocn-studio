"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_FORMAT,
  formatById,
  type VideoFormat,
} from "@/lib/studio/formats";
import type { Video } from "@/shared/ipc";

export interface NewVideo {
  canCreate: boolean;
  close: () => void;
  format: VideoFormat;
  isOpen: boolean;
  name: string;
  onFormatChange: (id: string) => void;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: () => void;
  submit: () => void;
}

// Two fields, and no folder: the project already decided where this lives.
// The slug is minted from the name in the sidecar and never moves again,
// which is what makes renaming free afterwards.
export function useNewVideo(
  create: (name: string, format: VideoFormat) => Promise<Video | null>
): NewVideo {
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<VideoFormat>(DEFAULT_FORMAT);

  const open = useCallback(() => {
    setName("");
    setFormat(DEFAULT_FORMAT);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const onFormatChange = useCallback((id: string) => {
    setFormat(formatById(id));
  }, []);

  const trimmed = name.trim();
  const canCreate = trimmed.length > 0;

  const submit = useCallback(async () => {
    if (trimmed.length === 0) {
      return;
    }
    setOpen(false);
    await create(trimmed, format);
  }, [create, format, trimmed]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit]
  );

  return useMemo(
    () => ({
      canCreate,
      close,
      format,
      isOpen,
      name,
      onFormatChange,
      onNameChange,
      onSubmit,
      open,
      submit,
    }),
    [
      canCreate,
      close,
      format,
      isOpen,
      name,
      onFormatChange,
      onNameChange,
      onSubmit,
      open,
      submit,
    ]
  );
}
