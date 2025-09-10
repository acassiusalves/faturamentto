"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookImage } from 'lucide-react';

export default function AnaliseProdutosPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [brand, setBrand] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <Card className="max-w-4xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-2xl">
            <BookImage className="h-6 w-6" />
            Análise de Catálogo PDF
          </CardTitle>
          <CardDescription>
            Faça o upload do seu catálogo em PDF e a IA irá extrair e listar os produtos para você, página por página.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="pdf-upload">Arquivo do Catálogo (.pdf)</Label>
              <Input 
                id="pdf-upload" 
                type="file" 
                accept="application/pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-input">Marca</Label>
              <Input 
                id="brand-input" 
                placeholder="Ex: Xiaomi"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
