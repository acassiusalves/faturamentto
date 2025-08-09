"use client";

import { useState, useEffect } from "react";
import { ProductCreator } from "@/components/product-creator";
import { ProductSettings } from "@/components/product-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Laptop, Settings, Loader2 } from "lucide-react";

export default function ProdutosPage() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Cadastro de Produtos</h1>
        <p className="text-muted-foreground">
          Crie modelos de produtos padronizados para usar no seu estoque.
        </p>
      </div>

      <Tabs defaultValue="celulares" className="w-full">
        <TabsList className="flex justify-between h-auto p-1">
            <div className="flex items-center">
              <TabsTrigger value="celulares">
                <Smartphone className="mr-2" />
                Celulares
              </TabsTrigger>
              <TabsTrigger value="notebooks" disabled>
                <Laptop className="mr-2" />
                Notebooks (Em Breve)
              </TabsTrigger>
            </div>
           <TabsTrigger value="configuracoes">
            <Settings className="mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>
        <TabsContent value="celulares"  className="pt-6">
          <ProductCreator category="Celular" />
        </TabsContent>
        <TabsContent value="notebooks">
           {/* Futuro componente para Notebooks */}
        </TabsContent>
         <TabsContent value="configuracoes" className="pt-6">
          <ProductSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
