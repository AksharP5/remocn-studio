"use client";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useQuitGuard } from "@/hooks/use-quit-guard";
import { useStudio } from "./studio-provider";

export function QuitGuard() {
  const { hasRunningTurns } = useStudio();
  const guard = useQuitGuard(hasRunningTurns);

  return (
    <AlertDialog onOpenChange={guard.setAsking} open={guard.isAsking}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Quit while Claude is working?</AlertDialogTitle>
          <AlertDialogDescription>
            Turns still running are stopped where they are. Whatever has already
            been written to disk stays; the block being streamed is lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            Keep working
          </AlertDialogClose>
          <AlertDialogClose
            onClick={guard.quitAnyway}
            render={<Button variant="destructive" />}
          >
            Quit
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
