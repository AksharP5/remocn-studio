"use client";

import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { componentGroups, filterAssets } from "@/lib/studio/pane-view";
import { cn } from "@/lib/utils";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";
import {
  AssetSearchField,
  NothingFound,
  OVER_TILES,
  UNDER_SEARCH_FIELD,
} from "./assets-pane";

const PLACEHOLDERS = ["one", "two", "three"];

function GroupHeading({ count, label }: { count: number; label: string }) {
  return (
    // `z-0` was the whole bug: the ground was always opaque, but a tile's
    // trigger is `absolute inset-0 z-10` and its actions `z-20`, so both
    // painted over a heading sitting at 0 and the role — the only thing saying
    // where you are among 99 components — went illegible exactly while
    // scrolling.
    <h3
      className={cn(
        "sticky flex h-8 shrink-0 items-center justify-between bg-sidebar px-2 font-medium text-sidebar-foreground/70 text-xs",
        OVER_TILES,
        UNDER_SEARCH_FIELD
      )}
    >
      {label}
      <span className="text-sidebar-foreground/50 tabular-nums">{count}</span>
    </h3>
  );
}

export function ComponentsPane({
  assets,
  bundled,
  error,
  isLoading,
  onPick,
  onRemove,
  onRetry,
}: {
  assets: readonly Asset[];
  bundled: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
}) {
  const search = useAssetSearch(assets);
  const isEmpty = assets.length === 0 && bundled.length === 0;
  const groups = componentGroups(
    search.found,
    filterAssets(bundled, search.query)
  );

  if (error !== null) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-balance">
            The library is unavailable
          </EmptyTitle>
          <EmptyDescription className="break-words">{error}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </Empty>
    );
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        {PLACEHOLDERS.map((placeholder) => (
          <SidebarMenuItem key={placeholder}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  if (isEmpty) {
    return (
      <Empty className="border-none px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-base">No components yet</EmptyTitle>
          <EmptyDescription className="text-pretty">
            Ask Claude to save an animation or a scene you like, and it will
            land here, ready to drop into any other video.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <AssetSearchField onChange={search.onQueryChange} value={search.query} />

      {groups.length === 0 ? <NothingFound query={search.query} /> : null}

      {groups.map((group) => (
        <div key={group.label}>
          <GroupHeading count={group.assets.length} label={group.label} />
          <AssetGrid
            assets={group.assets}
            onPick={onPick}
            onRemove={onRemove}
          />
        </div>
      ))}
    </div>
  );
}
