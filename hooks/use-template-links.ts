"use client";

import { useCallback, useRef } from "react";
import { toastManager } from "@/components/ui/toast";
import { useDeepLinks } from "@/hooks/use-deep-links";
import { parseDeepLink } from "@/shared/deep-link";
import type { Project } from "@/shared/ipc";
import type { TemplateDraft } from "@/shared/templates";

export type TemplateOutcome =
  | { readonly error: string }
  | { readonly project: Project };

export interface TemplateLinks {
  onOpened: (project: Project) => void;
  openTemplate: (draft: TemplateDraft) => Promise<TemplateOutcome>;
}

const REFUSED = "This link could not be opened";
const FAILED = "The project could not be created";

// A link is a request to make a project, and two links in a row are two
// projects, made one after the other: creation is asynchronous and the second
// must not start while the first is still choosing its folder.
export function useTemplateLinks({ onOpened, openTemplate }: TemplateLinks) {
  const queue = useRef<Promise<void>>(Promise.resolve());

  const onLink = useCallback(
    (url: string) => {
      const link = parseDeepLink(url);
      if (!link.ok) {
        toastManager.add({
          description: link.reason,
          title: REFUSED,
          type: "error",
        });
        return;
      }

      queue.current = queue.current.then(async () => {
        const outcome = await openTemplate({
          props: link.route.props,
          template: link.route.template,
        });

        if ("error" in outcome) {
          toastManager.add({
            description: outcome.error,
            title: FAILED,
            type: "error",
          });
          return;
        }

        onOpened(outcome.project);
      });
    },
    [onOpened, openTemplate]
  );

  useDeepLinks(onLink);
}
