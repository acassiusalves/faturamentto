
"use client";

import { useFormState, useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { runOpenAiAction } from '@/app/actions';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const initialState: { result: string | null; error: string | null } = {
  result: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
      Enviar para GPT
    </Button>
  );
}

export default function TestesGptPage() {
  const { toast } = useToast();
  const [state, formAction] = useFormState(runOpenAiAction, initialState);

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Erro na Requisição',
        description: state.error,
      });
    }
  }, [state.error, toast]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Testes com API GPT (OpenAI)</h1>
        <p className="text-muted-foreground">
          Use esta página para enviar prompts simples e ver a resposta da API da OpenAI.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Enviar Prompt</CardTitle>
            <CardDescription>
              A chave de API configurada na página de Mapeamento será utilizada. A resposta será formatada como JSON.
            </CardDescription>
          </CardHeader>
          <form action={formAction}>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="prompt">Seu Prompt</Label>
                <Textarea
                  id="prompt"
                  name="prompt"
                  placeholder='Ex: Liste 3 nomes de produtos de celular fictícios no formato {"products": ["nome1", "nome2", "nome3"]}'
                  rows={10}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <SubmitButton />
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resposta da API</CardTitle>
            <CardDescription>
              Abaixo está a resposta bruta retornada pela API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-md overflow-x-auto text-sm min-h-[200px]">
              {(() => {
                if (!state.result) return 'Aguardando requisição...';
                try {
                  return JSON.stringify(JSON.parse(state.result), null, 2);
                } catch {
                  return state.result; // mostra bruto se não for JSON
                }
              })()}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
