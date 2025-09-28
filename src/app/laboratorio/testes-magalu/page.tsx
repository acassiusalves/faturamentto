
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MagaluLogo } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plug, Loader2 } from 'lucide-react';

export default function TestesMagaluPage() {
  const [isLoading, setIsLoading] = useState(false);
  // States para os campos do formulário
  const [nomeConta, setNomeConta] = useState('');
  const [uuid, setUuid] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [clientId, setClientId] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const handleTestConnection = () => {
    // Lógica para testar a conexão virá aqui
    setIsLoading(true);
    console.log({ nomeConta, uuid, clientSecret, clientId, refreshToken, accessToken });
    setTimeout(() => setIsLoading(false), 2000); // Simula uma chamada de API
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Laboratório de Testes - Magalu</h1>
        <p className="text-muted-foreground">
          Área para testar integrações e funcionalidades com a API da Magazine Luiza.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <MagaluLogo className="h-10 w-auto" />
            <div>
                <CardTitle>Configuração da Conta Magalu</CardTitle>
                <CardDescription>
                    Insira as credenciais da sua conta de desenvolvedor da Magalu.
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nome-conta">Nome da Conta</Label>
                    <Input id="nome-conta" placeholder="Minha Loja na Magalu" value={nomeConta} onChange={(e) => setNomeConta(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="uuid">UUID</Label>
                    <Input id="uuid" placeholder="Seu UUID" value={uuid} onChange={(e) => setUuid(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input id="client-id" placeholder="Seu Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="client-secret">Client Secret</Label>
                    <Input id="client-secret" type="password" placeholder="Seu Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="refresh-token">Refresh Token</Label>
                <Input id="refresh-token" type="password" placeholder="Seu Refresh Token" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="access-token">Access Token (Opcional)</Label>
                <Input id="access-token" type="password" placeholder="Seu Access Token (se já tiver um válido)" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
            </div>
        </CardContent>
        <CardFooter>
            <Button onClick={handleTestConnection} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                Salvar e Testar Conexão
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
