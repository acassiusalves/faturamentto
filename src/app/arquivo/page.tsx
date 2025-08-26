
"use client";

import { PickingHistory } from "./picking-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailedEntryHistory } from './conferencia/detailed-entry-history';
import { ArrowDownToDot, ArrowUpFromDot } from "lucide-react";


export default function ArchivePage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Histórico de Atividades</h1>
        <p className="text-muted-foreground">Consulte o histórico de todas as entradas e saídas de estoque.</p>
      </div>
      <Tabs defaultValue="entradas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entradas">
              <ArrowDownToDot className="mr-2"/>
              Histórico de Entradas
            </TabsTrigger>
            <TabsTrigger value="saidas">
              <ArrowUpFromDot className="mr-2"/>
              Histórico de Saídas (Picking)
            </TabsTrigger>
        </TabsList>
        <TabsContent value="entradas" className="mt-6">
            <DetailedEntryHistory />
        </TabsContent>
        <TabsContent value="saidas" className="mt-6">
            <PickingHistory />
        </TabsContent>
    </Tabs>
    </div>
  );
}
