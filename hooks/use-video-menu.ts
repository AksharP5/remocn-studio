"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { Video } from "@/shared/ipc";

export interface VideoCommands {
  registerVideo: (videoId: string) => Promise<boolean>;
  removeVideo: (videoId: string) => Promise<boolean>;
  renameVideo: (videoId: string, name: string) => Promise<unknown>;
}

export interface VideoMenu {
  canRename: boolean;
  confirmRemove: () => void;
  isRemoving: boolean;
  isRenaming: boolean;
  name: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  openRemove: () => void;
  openRename: () => void;
  register: () => void;
  setRemoving: (open: boolean) => void;
  setRenaming: (open: boolean) => void;
}

export function useVideoMenu(video: Video, commands: VideoCommands): VideoMenu {
  const [isRenaming, setRenaming] = useState(false);
  const [isRemoving, setRemoving] = useState(false);
  const [name, setName] = useState(video.name);

  const { registerVideo, removeVideo, renameVideo } = commands;
  const { id } = video;
  const given = video.name;

  const openRename = useCallback(() => {
    setName(given);
    setRenaming(true);
  }, [given]);

  const openRemove = useCallback(() => setRemoving(true), []);

  const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const trimmed = name.trim();

  const submitRename = useCallback(async () => {
    if (trimmed.length === 0) {
      return;
    }
    setRenaming(false);
    await renameVideo(id, trimmed);
  }, [id, renameVideo, trimmed]);

  const confirmRemove = useCallback(async () => {
    setRemoving(false);
    await removeVideo(id);
  }, [id, removeVideo]);

  const register = useCallback(async () => {
    await registerVideo(id);
  }, [id, registerVideo]);

  const onRenameSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitRename();
    },
    [submitRename]
  );

  return useMemo(
    () => ({
      canRename: trimmed.length > 0,
      confirmRemove,
      isRemoving,
      isRenaming,
      name,
      onNameChange,
      onRenameSubmit,
      openRemove,
      openRename,
      register,
      setRemoving,
      setRenaming,
    }),
    [
      confirmRemove,
      isRemoving,
      isRenaming,
      name,
      onNameChange,
      onRenameSubmit,
      openRemove,
      openRename,
      register,
      trimmed,
    ]
  );
}
