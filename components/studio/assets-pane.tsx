"use client";

import { SearchIcon } from "lucide-react";
import type { ChangeEvent, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { fileManagerName } from "@/lib/studio/platform";
import { cn } from "@/lib/utils";
import type { Asset } from "@/shared/library";
import { AssetGrid } from "./asset-grid";

const PLACEHOLDERS = ["one", "two", "three"];

// Where a sticky thing under the search field has to start. The field is the
// input's `h-8.5` plus its wrapper's 1px border top and bottom plus `pb-2` —
// 44px, and 40px from `sm:`, where the input is `h-7.5`. Getting it wrong
// leaves a band between the two that scrolling tiles show through, so the two
// are one value rather than two that have to be remembered together.
export const UNDER_SEARCH_FIELD = "top-11 sm:top-10";

// A tile carries its own positioned children — an `absolute inset-0 z-10`
// trigger over the whole card and `z-20` actions — so the pane's sticky chrome
// has to sit above both or a tile scrolling under it takes the clicks. The
// trigger is transparent, so nothing looked wrong: the search field was on
// screen, stuck where it belongs, and simply did not answer. The field is the
// topmost of the two because a group heading stops exactly at its bottom edge.
export const OVER_TILES = "z-30";
export const OVER_HEADINGS = "z-40";

export function AssetSearchField({
  onChange,
  value,
}: {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    // Sticky against the pane's scroll container: the list scrolls under it
    // and the field never leaves the top. The background is what stops the
    // cards showing through the padding as they pass.
    <div className={cn("sticky top-0 bg-sidebar px-1 pb-2", OVER_HEADINGS)}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search by name"
          className="pl-8"
          onChange={onChange}
          placeholder="Search…"
          type="search"
          value={value}
        />
      </div>
    </div>
  );
}

export function NothingFound({ query }: { query: string }) {
  return (
    <p className="break-words px-2 py-4 text-muted-foreground text-sm">
      Nothing here is called “{query.trim()}”.
    </p>
  );
}

export function AssetsPane({
  assets,
  error,
  isLoading,
  isOver,
  onPick,
  onRemove,
  onRetry,
}: {
  assets: readonly Asset[];
  error: string | null;
  isLoading: boolean;
  isOver: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
}) {
  const search = useAssetSearch(assets);

  return (
    <div
      className={cn(
        "relative rounded-lg transition-colors",
        isOver && "bg-primary/5 outline-dashed outline-2 outline-primary/40"
      )}
    >
      {assets.length === 0 ? null : (
        <AssetSearchField
          onChange={search.onQueryChange}
          value={search.query}
        />
      )}

      <AssetsBody
        assets={search.found}
        error={error}
        isEmpty={assets.length === 0}
        isLoading={isLoading}
        onPick={onPick}
        onRemove={onRemove}
        onRetry={onRetry}
        query={search.query}
      />

      {isOver ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-foreground text-xs">
          Drop to add to the library
        </p>
      ) : null}
    </div>
  );
}

function AssetsBody({
  assets,
  error,
  isEmpty,
  isLoading,
  onPick,
  onRemove,
  onRetry,
  query,
}: {
  assets: readonly Asset[];
  error: string | null;
  isEmpty: boolean;
  isLoading: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
  query: string;
}) {
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
          <EmptyTitle className="text-base">Nothing saved yet</EmptyTitle>
          <EmptyDescription className="text-pretty">
            Drag pictures, video or sound here from {fileManagerName()}, or ask{" "}
            Claude to put an animation you like into the library. Everything
            here can be dropped into any other video.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (assets.length === 0) {
    return <NothingFound query={query} />;
  }

  return <AssetGrid assets={assets} onPick={onPick} onRemove={onRemove} />;
}
