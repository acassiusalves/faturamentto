
"use client";

import { useState, useEffect } from 'react';
import type { Sale } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Ticket } from 'lucide-react';

interface TicketTabProps {
  order: Sale | null;
}

export function TicketTab({ order }: TicketTabProps) {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // You can pre-fill the form if an order is passed
        if (order) {
            console.log("Opening ticket for order:", (order as any).order_code);
            // Here you would set your form state
        }
    }, [order]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Ticket />
                        {order ? `Abrir Ticket para o Pedido: ${(order as any).order_code}` : 'Gestão de Tickets'}
                    </CardTitle>
                    <CardDescription>Crie, visualize e gerencie os tickets de atendimento ao cliente.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Funcionalidade em desenvolvimento.</p>
                     {order && (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-semibold">Informações do Pedido Selecionado</h3>
                            <p><strong>Produto:</strong> {(order as any).item_title}</p>
                            <p><strong>Cliente:</strong> {(order as any).customer_name}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
