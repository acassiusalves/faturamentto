"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { PickingHistory } from "./picking-history";
import { StockConference } from "./conferencia/stock-conference";
import { FileText, CheckSquare } from "lucide-react";

export default function ArchivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'history';

  const onTabChange = (value: string) => {
    router.push(`/arquivo?tab=${value}`);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Arquivo e Conferência</h1>
        <p className="text-muted-foreground">Consulte o histórico de saídas e realize a conferência diária do estoque.</p>
      </div>

      <Tabs value={defaultTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history">
            <FileText className="mr-2" />
            Histórico de Picking
          </TabsTrigger>
          <TabsTrigger value="conference">
            <CheckSquare className="mr-2" />
            Conferência de Estoque
          </TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-6">
          <PickingHistory />
        </TabsContent>
        <TabsContent value="conference" className="mt-6">
          <StockConference />
        </TabsContent>
      </Tabs>
    </div>
  );
}
