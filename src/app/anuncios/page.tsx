
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Package, ExternalLink, Users, PackageCheck, Pencil, Save, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MercadoLivreLogo } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { useFormState } from 'react-dom';
import { updateMlAccountNicknameAction } from '@/app/actions';


interface MyItem {
    id: string;
    title: string;
    price: number;
    status: string;
    permalink: string;
    thumbnail: string;
    catalog_product_id?: string | null;
}

interface MlAccount {
    id: string; // Document ID from Firestore
    nickname?: string;
    // ... other fields if needed
}

const MyItemsList = ({ accountId, accountName }: { accountId: string, accountName: string }) => {
    const [items, setItems] = useState<MyItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleFetchItems = async () => {
        setIsLoading(true);
        setItems([]);
        try {
            const response = await fetch(`/api/ml/my-items?account=${accountId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar seus anúncios.');
            }

            setItems(data.items || []);
            toast({
                title: 'Sucesso!',
                description: `${data.items?.length || 0} anúncios ativos foram encontrados para ${accountName}.`
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Buscar Anúncios',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card className="shadow-none border-none">
            <CardHeader className="flex flex-row justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="h-5 w-5" />
                        Anúncios de {accountName}
                    </CardTitle>
                    <CardDescription>
                        Busca todos os anúncios com status "ativo" da conta no Mercado Livre.
                    </CardDescription>
                </div>
                 <Button onClick={handleFetchItems} disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" />}
                    {isLoading ? 'Buscando...' : 'Buscar Anúncios'}
                </Button>
            </CardHeader>
            {isLoading && (
                <CardContent>
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </CardContent>
            )}
            {items.length > 0 && !isLoading && (
                 <CardContent>
                    <div className="w-full rounded-md border max-h-[600px] overflow-y-auto">
                       <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Anúncio</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Preço</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <div className="relative h-16 w-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                                     <Image src={item.thumbnail} alt={item.title} fill className="object-contain" data-ai-hint="product image" />
                                                </div>
                                                <div className="flex flex-col">
                                                     <Link href={item.permalink} target="_blank" className="font-semibold text-primary hover:underline">
                                                        {item.title}
                                                        <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                     </Link>
                                                     <span className="text-xs text-muted-foreground font-mono">Item ID: {item.id}</span>
                                                     {item.catalog_product_id && <span className="text-xs text-muted-foreground font-mono">Catálogo ID: {item.catalog_product_id}</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={item.status === 'active' ? 'bg-green-600' : ''}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-lg">{formatCurrency(item.price)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                       </Table>
                    </div>
                </CardContent>
            )}
        </Card>
    )
}

function AccountItem({ account, onUpdate }: { account: MlAccount, onUpdate: () => void }) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [nickname, setNickname] = useState(account.nickname || '');

    const [formState, formAction] = useFormState(updateMlAccountNicknameAction, { success: false, error: null });

    const handleSave = () => {
        const formData = new FormData();
        formData.append('accountId', account.id);
        formData.append('nickname', nickname);
        formAction(formData);
    };

    useEffect(() => {
        if (formState.success) {
            toast({ title: 'Sucesso!', description: 'O nome da conta foi atualizado.' });
            setIsEditing(false);
            onUpdate();
        }
        if (formState.error) {
            toast({ variant: 'destructive', title: 'Erro', description: formState.error });
        }
    }, [formState, toast, onUpdate]);

    return (
        <AccordionItem value={account.id} key={account.id}>
            <div className="flex w-full items-center p-1 pr-4">
                <AccordionTrigger className="flex-1">
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground"/>
                        {isEditing ? (
                             <Input 
                                value={nickname} 
                                onChange={(e) => setNickname(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8"
                            />
                        ) : (
                            <span className="font-semibold text-lg">{account.nickname || account.id}</span>
                        )}
                    </div>
                </AccordionTrigger>
                 <div className="flex items-center gap-1 pl-2">
                    {isEditing ? (
                        <>
                            <Button variant="ghost" size="icon" onClick={handleSave}>
                                <Save className="h-5 w-5 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
                                <XCircle className="h-5 w-5 text-destructive" />
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            <AccordionContent className="p-0">
                <MyItemsList accountId={account.id} accountName={nickname || account.id} />
            </AccordionContent>
        </AccordionItem>
    );
}


const AccountsList = () => {
    const [accounts, setAccounts] = useState<MlAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const handleFetchAccounts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/ml/accounts');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar as contas.');
            }
            setAccounts(data.accounts || []);
            if (!data.accounts || data.accounts.length === 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Nenhuma Conta Encontrada',
                    description: `Nenhuma conta foi encontrada. Adicione suas contas em Mapeamento > Mercado Livre.`
                });
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Erro ao Buscar Contas',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        handleFetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MercadoLivreLogo className="h-6 w-6" />
                    Contas do Mercado Livre
                </CardTitle>
                <CardDescription>
                    Selecione uma conta para buscar e visualizar os seus anúncios ativos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : accounts.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                        {accounts.map(account => (
                           <AccountItem key={account.id} account={account} onUpdate={handleFetchAccounts} />
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        <p>Nenhuma conta do Mercado Livre encontrada.</p>
                        <p className="text-sm">Vá para <Link href="/mapeamento" className="underline font-semibold">Mapeamento</Link> para adicionar suas contas.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default function AnunciosPage() {
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Gerenciador de Anúncios</h1>
                <p className="text-muted-foreground">
                    Busque e visualize os anúncios ativos das suas contas no Mercado Livre.
                </p>
            </div>
            
            <AccountsList />

        </div>
    );
}

    