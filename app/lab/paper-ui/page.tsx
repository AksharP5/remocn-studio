import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PaperUiLab } from "./paper-ui-lab";

const inter = Inter({ adjustFontFallback: false, subsets: ["latin"] });

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Appearance lab · Remocn",
};

export default function PaperUiPage() {
  return (
    <PaperUiLab
      dmSansFamily="var(--font-dm-sans)"
      interFamily={inter.style.fontFamily}
    />
  );
}
