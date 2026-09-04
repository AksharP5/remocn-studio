"use client";

import { FileTextIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TabsPrimitive } from "@/components/ui/tabs";
import type { Docs } from "@/hooks/use-docs";
import { DocTabs } from "./doc-tabs";
import { Markdown } from "./markdown";
import { PaneBody } from "./pane";

/**
 * The right pane's second mode: the documents the production pipeline writes,
 * read where the person looks for the result of the work rather than in a
 * file tree.
 */
export function DocsView({ docs }: { docs: Docs }) {
  if (docs.tabs.length === 0) {
    return (
      <PaneBody>
        <NoDocuments folder={docs.folder} />
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <TabsPrimitive.Root
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        onValueChange={docs.onPickTab}
        value={docs.openPath}
      >
        <DocTabs tabs={docs.tabs} />

        <TabsPrimitive.Panel
          className="min-h-0 flex-1 overflow-y-auto outline-none"
          value={docs.openPath}
        >
          <Body docs={docs} />
        </TabsPrimitive.Panel>
      </TabsPrimitive.Root>
    </PaneBody>
  );
}

function Body({ docs }: { docs: Docs }) {
  if (docs.error !== null) {
    return (
      <p
        className="px-6 py-8 text-center text-destructive text-xs [overflow-wrap:anywhere]"
        role="alert"
      >
        {docs.error}
      </p>
    );
  }

  if (docs.open === null) {
    // The read is one file off local disk, so a skeleton would flash rather
    // than inform; the strip above already says which document is coming.
    return docs.isLoading ? null : <NoDocuments folder={docs.folder} />;
  }

  return (
    <article className="mx-auto max-w-[65ch] px-6 py-6">
      <Markdown isAnimated={false}>{docs.open.text}</Markdown>
    </article>
  );
}

function NoDocuments({ folder }: { folder: string | null }) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>No documents yet</EmptyTitle>
        <EmptyDescription>
          Analysis, brand, script and motion are written to{" "}
          <span className="font-mono text-[0.9em]">
            {folder === null ? "the video's docs folder" : folderName(folder)}
          </span>{" "}
          as the video is planned. Ask for a video to start one.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// The absolute path is long enough to wrap three times in a 360px pane, and
// the part that says anything is the video's own folder.
function folderName(folder: string): string {
  const parts = folder.split("/").filter((part) => part !== "");

  return parts.slice(-3).join("/");
}
