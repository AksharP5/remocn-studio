import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Golos_Text } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const dmSans = DM_Sans({
  adjustFontFallback: false,
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

// DM Sans ships no Cyrillic at all, so without this every Russian sentence
// falls to the Arial-based fallback next/font fabricates. Golos sits after
// DM Sans in the stack: Latin never reaches it, Cyrillic lands in a sturdy
// UI grotesque whose regular matches DM Sans's stroke weight — Manrope was
// tried first and its 400 reads a full step thinner.
const golos = Golos_Text({
  preload: false,
  subsets: ["cyrillic", "cyrillic-ext"],
  variable: "--font-cyrillic",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const REVEAL_STUDIO = `
(() => {
  const tauri = window.__TAURI_INTERNALS__;
  if (!tauri) return;

  const reveal = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tauri.invoke("reveal_studio").catch(() => undefined);
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal, { once: true });
  } else {
    reveal();
  }
})();
`;

export const metadata: Metadata = {
  description:
    "Build Remotion videos with your coding agent, without touching a terminal.",
  title: "Remocn Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the
    // theme class onto <html> before React hydrates.
    <html
      className={cn(
        golos.variable,
        "font-sans",
        dmSans.variable,
        geistMono.variable
      )}
      lang="en"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Script id="reveal-studio" strategy="beforeInteractive">
          {REVEAL_STUDIO}
        </Script>
      </body>
    </html>
  );
}
