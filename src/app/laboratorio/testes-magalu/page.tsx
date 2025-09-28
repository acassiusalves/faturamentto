
"use client";

import { useState, useEffect } from 'react';
import { useFormState } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MagaluLogo } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plug, Loader2, List, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadAppSettings, getMagaluTokens } from '@/services/firestore';
import { saveMagaluCredentialsAction } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { MagaluSku } from '@/services/magalu';


const initialState = { success: false, error: null, message: '' };

export default function TestesMagaluPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [state, formAction] = useFormState(saveMagaluCredentialsAction, initialState);

  // States para os campos do formulário
  const [accountName, setAccountName] = useState('');
  const [uuid, setUuid] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [clientId, setClientId] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // States para listagem de anúncios
  const [isListing, setIsListing] = useState(false);
  const [listings, setListings] = useState<MagaluSku[]>([]);

  useEffect(() => {
    async function loadData() {
        const settings = await loadAppSettings();
        const magaluCreds = await getMagaluTokens(); // Busca as credenciais
        if (magaluCreds) {
            setAccountName(magaluCreds.accountName || '');
            setUuid(magaluCreds.uuid || '');
            setClientId(magaluCreds.clientId || '');
            setClientSecret(magaluCreds.clientSecret || '');
            setRefreshToken(magaluCreds.refreshToken || '');
            setAccessToken(magaluCreds.accessToken || '');
        }
        setIsLoading(false);
    }
    loadData();
  }, []);
  
   useEffect(() => {
    if (state.success) {
      toast({ title: "Sucesso!", description: state.message });
    }
    if (state.error) {
      toast({ variant: 'destructive', title: "Erro", description: state.error });
    }
  }, [state, toast]);

  const handleListSkus = async () => {
    setIsListing(true);
    setListings([]);
    try {
        const response = await fetch(`/api/magalu/listings?accountId=${uuid}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha ao listar os anúncios da Magalu.');
        }

        setListings(data.items || []);
        toast({ title: 'Sucesso!', description: `${data.items?.length || 0} anúncios encontrados.` });

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Listar Anúncios', description: e.message });
    } finally {
        setIsListing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Laboratório de Testes - Magalu</h1>
        <p className="text-muted-foreground">
          Área para testar integrações e funcionalidades com a API da Magazine Luiza.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          <form action={formAction}>
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
                          <Input id="nome-conta" name="accountName" placeholder="Minha Loja na Magalu" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="uuid">UUID (ID da Conta)</Label>
                          <Input id="uuid" name="uuid" placeholder="Seu UUID" value={uuid} onChange={(e) => setUuid(e.target.value)} />
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="client-id">Client ID</Label>
                          <Input id="client-id" name="clientId" placeholder="Seu Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="client-secret">Client Secret</Label>
                          <Input id="client-secret" name="clientSecret" type="password" placeholder="Seu Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                      </div>
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="refresh-token">Refresh Token</Label>
                      <Input id="refresh-token" name="refreshToken" type="password" placeholder="Seu Refresh Token" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} />
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="access-token">Access Token (Opcional)</Label>
                      <Input id="access-token" name="accessToken" type="password" placeholder="Será gerado automaticamente se vazio" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                  </div>
              </CardContent>
              <CardFooter className="gap-4">
                <Button type="submit">
                    <Plug className="mr-2 h-4 w-4" />
                    Salvar e Testar Conexão
                </Button>
                <Button variant="secondary" onClick={handleListSkus} disabled={isListing || !uuid}>
                    {isListing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <List className="mr-2 h-4 w-4"/>}
                    Listar Anúncios
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Anúncios Encontrados ({listings.length})</CardTitle>
                <CardDescription>Lista de SKUs, preços e estoques encontrados na sua conta Magalu.</CardDescription>
            </CardHeader>
            <CardContent>
                {isListing ? (
                    <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>
                ) : listings.length > 0 ? (
                    <div className="rounded-md border max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Título</TableHead>
                                    <TableHead className="text-right">Preço</TableHead>
                                    <TableHead className="text-right">Estoque</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {listings.map(item => (
                                    <TableRow key={item.sku}>
                                        <TableCell className="font-mono">{item.sku}</TableCell>
                                        <TableCell className="font-medium">{item.title}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(item.price?.offer_price)}</TableCell>
                                        <TableCell className="text-right font-bold">{item.stock?.quantity ?? 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                        <Package className="h-12 w-12 mb-4" />
                        <p>Nenhum anúncio encontrado.</p>
                        <p className="text-sm">Clique em "Listar Anúncios" para buscar.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
