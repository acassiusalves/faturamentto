"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Feed25Page() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Feed 25</h1>
        <p className="text-muted-foreground">
          Esta é a nova página Feed 25.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo da Página</CardTitle>
          <CardDescription>
            O conteúdo para esta página será adicionado aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Página em construção...</p>
        </CardContent>
      </Card>
    </div>
  );
}
