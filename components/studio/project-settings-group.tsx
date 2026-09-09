import type { ReactNode } from "react";

import { SettingsGroup } from "./settings-group";

export function ProjectSettingsGroup(
  props: Parameters<typeof SettingsGroup>[0]
) {
  return <SettingsGroup {...props} />;
}

export function ProjectSettingsRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
      <div className="min-w-0 flex-1 basis-48 space-y-1">
        {htmlFor ? (
          <label className="text-sm" htmlFor={htmlFor}>
            {title}
          </label>
        ) : (
          <p className="text-sm">{title}</p>
        )}
        {description ? (
          <p className="break-words text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="w-full min-w-0 sm:w-auto sm:max-w-[55%]">{children}</div>
    </div>
  );
}
