
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function EtiquetasPage() {
  const [orderId, setOrderId] = useState('');
  const [format, setFormat] = useState('PDF');

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
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="order-id" className="font-semibold">ID</Label>
                  <Input 
                    type="text" 
                    id="order-id" 
                    placeholder="Insira o ID do pedido" 
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                  />
              </div>
              <div className="grid w-full max-w-[180px] items-center gap-1.5">
                  <Label htmlFor="format" className="font-semibold">Formato</Label>
                   <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger id="format">
                          <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="PDF">PDF</SelectItem>
                          <SelectItem value="ZPL">ZPL</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <Button>
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
