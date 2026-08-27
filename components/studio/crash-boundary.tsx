"use client";

import { ErrorBoundary } from "@sentry/react";
import { Button } from "@/components/ui/button";

// Outside `StudioProvider`, deliberately: a render error thrown while the
// workspace is being built is exactly the kind of crash nobody would ever
// write in about, and a boundary inside the provider could not catch it.
//
// It earns its place with or without a Sentry client. React 19 unmounts the
// whole tree when a render throws and nothing catches it, so what this
// replaces is not an error screen but a black window — and `captureException`
// with no client initialised is a no-op, so the fallback is the same with
// consent withheld.
export function CrashBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallback={CrashScreen}>{children}</ErrorBoundary>;
}

function reload() {
  window.location.reload();
}

function CrashScreen() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 bg-background px-8 text-center"
      data-tauri-drag-region
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-sm">The studio stopped drawing</h1>
        <p className="max-w-sm text-muted-foreground text-xs leading-snug">
          Your projects and every conversation are on disk and are untouched by
          this. Reloading rebuilds the window from them.
        </p>
      </div>

      <Button onClick={reload} size="sm" variant="outline">
        Reload the window
      </Button>
    </div>
  );
}
