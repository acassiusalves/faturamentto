

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Package, ExternalLink, Users, PackageCheck, Pencil, Save, XCircle, Info, DollarSign, Tag, Truck, ShieldCheck, ShoppingCart, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MercadoLivreLogo, FullIcon, CorreiosLogo, MercadoEnviosIcon, FreteGratisIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { useFormState } from 'react-dom';
import { updateMlAccountNicknameAction } from '@/app/actions';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MyItem } from '@/lib/types';


interface MlAccount {
    id: string; // Document ID from Firestore
    nickname?: string;
    // ... other fields if needed
}

const getSku = (attributes: MyItem['attributes'] | MyItem['variations'][0]['attributes'], sellerCustomField: string | null) => {
    const skuAttribute = attributes.find(attr => attr.id === 'SELLER_SKU');
    return skuAttribute?.value_name || sellerCustomField || 'N/A';
};

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

            const fetchedItems: MyItem[] = data.items || [];
            setItems(fetchedItems);

            if (fetchedItems.length > 0) {
                 toast({
                    title: 'Sucesso!',
                    description: `${fetchedItems.length} anúncios ativos foram encontrados para ${accountName}.`
                });
            } else {
                 toast({
                    title: 'Nenhum Anúncio',
                    description: `Nenhum anúncio ativo foi encontrado para ${accountName}.`
                });
            }

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
                    <div className="flex items-center justify-center p-8 gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Buscando anúncios...</p>
                    </div>
                </CardContent>
            )}
            {items.length > 0 && !isLoading && (
                <>
                 <CardContent>
                    <Accordion type="single" collapsible className="w-full space-y-2">
                        {items.map(item => {
                            const mainSku = getSku(item.attributes, item.seller_custom_field);
                            return (
                            <AccordionItem value={item.id} key={item.id}>
                               <Card>
                                 <AccordionTrigger className="w-full p-3 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left w-full">
                                         <div className="relative h-20 w-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                             <Image src={item.thumbnail} alt={item.title} fill className="object-contain" data-ai-hint="product image" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-primary line-clamp-2" title={item.title}>
                                                {item.title}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <span>ID: <span className="font-mono">{item.id}</span></span>
                                                {mainSku !== 'N/A' && <span>| SKU: <span className="font-mono">{mainSku}</span></span>}
                                                {item.catalog_product_id && <span>| Catálogo: <span className="font-mono">{item.catalog_product_id}</span></span>}
                                            </div>
                                        </div>
                                         <div className="text-right">
                                            <p className="font-bold text-lg">{formatCurrency(item.price)}</p>
                                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={cn('mt-1', item.status === 'active' ? 'bg-green-600' : '')}>
                                                {item.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-2">
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <h4 className="font-semibold flex items-center gap-1.5"><Info /> Informações Gerais</h4>
                                            <p className="text-sm">Garantia: <span className="font-medium">{item.warranty || 'Não especificada'}</span></p>
                                            <p className="text-sm">Disponível: <span className="font-medium">{item.available_quantity} un.</span></p>
                                            <p className="text-sm">Vendidos: <span className="font-medium">{item.sold_quantity} un.</span></p>
                                             {item.accepts_mercadopago && <Badge variant="secondary">Aceita Mercado Pago</Badge>}
                                        </div>
                                        <div className="space-y-2">
                                             <h4 className="font-semibold flex items-center gap-1.5"><Truck /> Frete</h4>
                                            <div className="flex items-center gap-2">
                                                {item.shipping.logistic_type === 'fulfillment' && <FullIcon />}
                                                {item.shipping.logistic_type === 'drop_off' && <CorreiosLogo />}
                                                {item.shipping.logistic_type === 'cross_docking' && <MercadoEnviosIcon />}
                                                {item.shipping.free_shipping && <FreteGratisIcon />}
                                            </div>
                                            <p className="text-sm">Modo: <span className="font-medium">{item.shipping.mode}</span></p>
                                            <div className="flex flex-wrap gap-1">
                                                {item.shipping.tags.map((tag: string) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                                            </div>
                                        </div>
                                        {item.variations?.length > 0 && (
                                            <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                                <h4 className="font-semibold flex items-center gap-1.5"><PackageCheck /> Variações ({item.variations.length})</h4>
                                                <ScrollArea className="h-48 rounded-md border p-2 bg-muted/50">
                                                    <div className="space-y-3">
                                                    {item.variations.map(variation => {
                                                        const variationSku = getSku(variation.attributes, variation.seller_custom_field);
                                                        const variationName = variation.attribute_combinations.map(v => v.value_name).join(' / ');
                                                        return (
                                                            <div key={variation.id} className="text-xs p-2 border-b last:border-0">
                                                                <div className="font-semibold">{variationName}</div>
                                                                <div className="flex justify-between items-center text-muted-foreground">
                                                                    <span>SKU: <span className="font-mono text-foreground">{variationSku}</span></span>
                                                                    <span>Qtd: <span className="font-semibold text-foreground">{variation.available_quantity}</span></span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                   </div>
                                </AccordionContent>
                               </Card>
                            </AccordionItem>
                        )})}
                    </Accordion>
                </CardContent>
                </>
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
                    Busque, visualize e salve os anúncios ativos das suas contas no Mercado Livre.
                </p>
            </div>
            
            <AccountsList />

        </div>
    );
}

    
