"use client";

import { createContext, use } from "react";

export const PreviewPresentation = createContext<"iframe" | "canvas">("canvas");
export const usePreviewPresentation = () => use(PreviewPresentation);
