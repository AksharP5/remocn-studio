import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PaperUiLab } from "./paper-ui-lab";

const inter = Inter({ subsets: ["latin"], adjustFontFallback: false });

export const metadata: Metadata = {
  title: "Appearance lab · Remocn",
  robots: { index: false, follow: false },
};

export default function PaperUiPage() {
  return (
    <PaperUiLab
      dmSansFamily="var(--font-dm-sans)"
      interFamily={inter.style.fontFamily}
    />
  );
}
