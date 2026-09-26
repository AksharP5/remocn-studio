import { AppShell } from "@/components/studio/app-shell";
import { ContextMenuGuard } from "@/components/studio/context-menu-guard";

export default function Page() {
  return (
    <>
      <ContextMenuGuard />
      <AppShell />
    </>
  );
}
