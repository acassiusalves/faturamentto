"use client";

import { PickingHistory } from "./picking-history";

export default function ArchivePage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Histórico de Picking</h1>
        <p className="text-muted-foreground">Consulte o histórico de todas as saídas de estoque.</p>
      </div>
      <PickingHistory />
    </div>
  );
}
