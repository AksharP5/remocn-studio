"use client";

import type { ReactNode } from "react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

// A view is one column: what is pinned stays put and only the list under it
// scrolls. A control that has to stay reachable — a search field, New video —
// is pinned here rather than made `sticky` inside the scroller: WKWebView draws
// a stuck element at the top and hit-tests it where it was laid out, so once
// the list had scrolled the field looked fine and a click landed on the tile
// underneath. Nothing interactive rides the scroller as sticky any more; the
// role headings still do, and they take no clicks.
export function PaneScreen({
  children,
  pinned,
  scrollFade = true,
}: {
  children: ReactNode;
  pinned?: ReactNode;
  scrollFade?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* `p-2` is what `SidebarGroup` gives the scrolling half, so the pinned
          block keeps the list's own left and right edge. */}
      {pinned === undefined || pinned === null ? null : (
        <div className="px-2 pt-2">{pinned}</div>
      )}

      <SidebarContent scrollFade={scrollFade}>
        <SidebarGroup>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </div>
  );
}
