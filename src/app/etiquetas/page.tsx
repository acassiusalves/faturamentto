
"use client";

import { useActionState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { fetchLabelAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const initialState = {
  rawResponse: null,
  error: null,
};

export default function EtiquetasPage() {
  const [state, formAction] = useActionState(fetchLabelAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar etiqueta',
        description: state.error,
      });
    }
  }, [state, toast]);


  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciador de Etiquetas</h1>
        <p className="text-muted-foreground">
          Gere e imprima as etiquetas para os seus envios.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Buscar Etiqueta por Pedido</CardTitle>
            <CardDescription>Insira o ID do pedido e selecione o formato desejado.</CardDescription>
        </CardHeader>
        <CardContent>
            <form action={formAction}>
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="order-id" className="font-semibold">ID do Pedido</Label>
                    <Input 
                      type="text" 
                      id="order-id" 
                      name="orderId"
                      placeholder="Insira o ID do pedido"
                      required
                    />
                </div>
                <div className="grid w-full max-w-[180px] items-center gap-1.5">
                    <Label htmlFor="format" className="font-semibold">Formato</Label>
                    <Select name="format" defaultValue="PDF">
                        <SelectTrigger id="format">
                            <SelectValue placeholder="Selecione o formato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PDF">PDF</SelectItem>
                            <SelectItem value="ZPL">ZPL</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit">
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              </div>
            </form>
        </CardContent>
      </Card>

      {state.rawResponse && (
        <Card>
            <CardHeader>
                <CardTitle>Resposta da API Ideris</CardTitle>
                <CardDescription>Estes são os dados brutos retornados pela Ideris para a sua solicitação.</CardDescription>
            </CardHeader>
            <CardContent>
                <pre className="p-4 bg-muted rounded-md overflow-x-auto text-sm">
                    <code>
                        {JSON.stringify(state.rawResponse, null, 2)}
                    </code>
                </pre>
            </CardContent>
        </Card>
      )}

       {state.error && !state.rawResponse && (
        <Alert variant="destructive">
            <AlertTitle>Erro na Solicitação</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
