
"use client";
import { ReturnsForm } from './returns-form';


export default function DevolucoesPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
       <div>
          <h1 className="text-3xl font-bold font-headline">Devolução de Pedidos</h1>
          <p className="text-muted-foreground">Registre a entrada de produtos retornados por clientes.</p>
        </div>
        <ReturnsForm />
    </div>
  );
}
