
"use client";
import { Loader2 } from "lucide-react";

export function ProcessingStatus({ isRemixingZpl }: { isRemixingZpl: boolean }) {
  if (!isRemixingZpl) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Processando ZPL…</span>
    </div>
  );
}
