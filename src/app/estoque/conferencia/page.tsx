
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndividualConference } from './individual-conference';
import { StockConference } from './stock-conference';
import { Package, User } from "lucide-react";

export default function ConferencePage() {
  const [activeTab, setActiveTab] = useState("stock");

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Conferência de Estoque</h1>
        <p className="text-muted-foreground">Analise o resumo diário do estoque ou faça uma conferência individual de itens.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stock">
              <Package className="mr-2"/>
              Resumo Diário
          </TabsTrigger>
          <TabsTrigger value="individual">
              <User className="mr-2"/>
              Conferência Individual
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-6">
          <StockConference />
        </TabsContent>
        <TabsContent value="individual" className="mt-6">
          <IndividualConference />
        </TabsContent>
      </Tabs>
    </div>
  );
}
