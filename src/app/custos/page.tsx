"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Trash2, DollarSign, PlusCircle, Loader2 } from "lucide-react";
import type { CompanyCost } from "@/lib/types";
import { saveCompanyCosts, loadCompanyCosts } from "@/lib/mock-services";

type CostCategory = "fixed" | "variable";

export default function CostsPage() {
  const [fixedCosts, setFixedCosts] = useState<CompanyCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<CompanyCost[]>([]);
  const { toast } = useToast();

  const [newCostDescription, setNewCostDescription] = useState("");
  const [newCostValue, setNewCostValue] = useState("");
  const [currentCategory, setCurrentCategory] = useState<CostCategory>("fixed");
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
        setIsDataLoading(true);
        const costs = await loadCompanyCosts();
        if (costs) {
            setFixedCosts(costs.fixed || []);
            setVariableCosts(costs.variable || []);
        }
        setIsDataLoading(false);
    }
    loadData();
  }, []);

  const saveCosts = (category: CostCategory, costs: CompanyCost[]) => {
    const updatedCosts = category === 'fixed' 
        ? { fixed: costs, variable: variableCosts } 
        : { fixed: fixedCosts, variable: costs };
    saveCompanyCosts("user-id-placeholder", updatedCosts);
  };

  const handleAddCost = () => {
    if (!newCostDescription || !newCostValue) {
      toast({
        title: "Campos Obrigatórios",
        description: "Por favor, preencha a descrição e o valor do custo.",
        variant: "destructive",
      });
      return;
    }

    const newCost: CompanyCost = {
      id: `${currentCategory}-${Date.now()}`,
      description: newCostDescription,
      value: parseFloat(newCostValue),
    };

    if (currentCategory === "fixed") {
      const updated = [...fixedCosts, newCost];
      setFixedCosts(updated);
      saveCosts("fixed", updated);
    } else {
      const updated = [...variableCosts, newCost];
      setVariableCosts(updated);
      saveCosts("variable", updated);
    }

    setNewCostDescription("");
    setNewCostValue("");
    toast({
      title: "Custo Adicionado",
      description: `O custo "${newCost.description}" foi adicionado com sucesso.`,
    });
  };

  const handleRemoveCost = (category: CostCategory, id: string) => {
    let updatedCosts: CompanyCost[] = [];
    let costDescription = "";

    if (category === "fixed") {
      costDescription = fixedCosts.find(c => c.id === id)?.description || "";
      updatedCosts = fixedCosts.filter((cost) => cost.id !== id);
      setFixedCosts(updatedCosts);
      saveCosts("fixed", updatedCosts);
    } else {
      costDescription = variableCosts.find(c => c.id === id)?.description || "";
      updatedCosts = variableCosts.filter((cost) => cost.id !== id);
      setVariableCosts(updatedCosts);
      saveCosts("variable", updatedCosts);
    }

    toast({
      title: "Custo Removido",
      description: `O custo "${costDescription}" foi removido.`,
    });
  };
  
  const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  const calculateTotal = (costs: CompanyCost[]) => costs.reduce((acc, cost) => acc + cost.value, 0);
  
  const totalFixedCosts = calculateTotal(fixedCosts);
  const totalVariableCosts = calculateTotal(variableCosts);
  const totalOverallCosts = totalFixedCosts + totalVariableCosts;

  if (isDataLoading) {
    return (
       <div className="flex items-center justify-center h-[calc(100vh-200px)]">
         <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando...</p>
      </div>
    );
  }

  const CostList = ({ title, description, costs, category }: { title: string; description: string; costs: CompanyCost[]; category: CostCategory }) => (
    <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="space-y-2">
          {costs.length > 0 ? (
            costs.map((cost) => (
              <div key={cost.id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                <span className="text-sm">{cost.description}</span>
                <div className="flex items-center gap-4">
                  <span className="font-medium">{formatCurrency(cost.value)}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveCost(category, cost.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo adicionado nesta categoria.</p>
          )}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Central de Custos</h1>
        <p className="text-muted-foreground">
          Gerencie os custos fixos e variáveis da sua empresa para um cálculo preciso da lucratividade.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 space-y-4">
           <Card>
                <CardHeader>
                    <CardTitle>Adicionar Novo Custo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="cost-desc">Descrição do Custo</Label>
                        <Input id="cost-desc" value={newCostDescription} onChange={(e) => setNewCostDescription(e.target.value)} placeholder="Ex: Aluguel do Escritório" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="cost-value">Valor Mensal (R$)</Label>
                        <Input id="cost-value" type="number" value={newCostValue} onChange={(e) => setNewCostValue(e.target.value)} placeholder="Ex: 1500.00" />
                    </div>
                    <div className="space-y-2">
                        <Label>Categoria do Custo</Label>
                        <div className="flex gap-2">
                            <Button variant={currentCategory === 'fixed' ? 'default' : 'outline'} className="flex-1" onClick={() => setCurrentCategory('fixed')}>Fixo</Button>
                            <Button variant={currentCategory === 'variable' ? 'default' : 'outline'} className="flex-1" onClick={() => setCurrentCategory('variable')}>Variável</Button>
                        </div>
                    </div>
                    <Button onClick={handleAddCost} className="w-full">
                        <PlusCircle className="mr-2"/>
                        Adicionar
                    </Button>
                </CardContent>
           </Card>
           
        </div>
        
        <div className="md:col-span-2 space-y-8">
            <CostList 
                title="Custos Fixos"
                description="Custos que ocorrem independentemente do volume de vendas."
                costs={fixedCosts} 
                category="fixed" 
            />
            <CostList 
                title="Custos Variáveis" 
                description="Custos que variam de acordo com o volume de produção ou vendas."
                costs={variableCosts} 
                category="variable" 
            />
            
            <Separator />
            
             <div className="space-y-4">
                 <h2 className="text-xl font-semibold">Resumo dos Custos</h2>
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total de Custos Fixos</span>
                            <span className="font-bold text-lg">{formatCurrency(totalFixedCosts)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total de Custos Variáveis</span>
                            <span className="font-bold text-lg">{formatCurrency(totalVariableCosts)}</span>
                        </div>
                        <Separator />
                         <div className="flex justify-between items-center text-primary">
                            <span className="font-semibold">CUSTO OPERACIONAL TOTAL</span>
                            <span className="font-bold text-2xl">{formatCurrency(totalOverallCosts)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
}
