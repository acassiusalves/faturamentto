
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { findInventoryItemBySN, loadTodaysPickingLog, loadAppSettings, loadSales, saveSales, findSaleByOrderNumber, savePickLog, revertPickingAction, clearTodaysPickingLog as clearLogService, deleteInventoryItem, findProductByAssociatedSku, createApprovalRequest } from '@/services/firestore';

import type { InventoryItem, PickedItemLog, Sale, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PackageCheck, ScanLine, Ticket, Search, History, Timer, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, XCircle, Trash2, CheckCircle, PackageSearch, AlertTriangle, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchOrdersFromIderis } from '@/services/ideris';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/auth-context';


const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function PickingPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [orderNumber, setOrderNumber] = useState('');
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [associatedProduct, setAssociatedProduct] = useState<Product | null>(null);
  
  const [currentSN, setCurrentSN] = useState('');
  const [scannedItems, setScannedItems] = useState<InventoryItem[]>([]);
  const [isSearchingSN, setIsSearchingSN] = useState(false);

  const [isConfirming, setIsConfirming] = useState(false);
  const [todaysPicks, setTodaysPicks] = useState<PickedItemLog[]>([]);
  const [isLoadingPicks, setIsLoadingPicks] = useState(true);
  
  const [pickSearchTerm, setPickSearchTerm] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [autoSubmitDelay, setAutoSubmitDelay] = useState<number>(5000); // Default 5s
  
  const [countdown, setCountdown] = useState<number | null>(null);

  const [mismatchItem, setMismatchItem] = useState<InventoryItem | null>(null);
  const [isMismatchDialogOpen, setIsMismatchDialogOpen] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const serialNumberRef = useRef<HTMLInputElement>(null);
  const orderNumberRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchTodaysPicks = useCallback(async () => {
      setIsLoadingPicks(true);
      const picks = await loadTodaysPickingLog();
      setTodaysPicks(picks);
      setIsLoadingPicks(false);
  }, []);

  const autoSyncIderis = useCallback(async () => {
    if (isSyncing) return;
    const settings = await loadAppSettings();
    if (!settings?.iderisPrivateKey || settings.iderisApiStatus !== 'valid') {
        toast({ variant: 'destructive', title: 'Sincronização Pausada', description: 'Valide sua chave da Ideris na página de Mapeamento para buscar novos pedidos.'})
        return;
    }
    
    setIsSyncing(true);
    toast({ title: "Sincronizando...", description: "Buscando novos pedidos em segundo plano." });

    try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 1);

        const existingSales = await loadSales();
        const existingSaleIds = existingSales.map(s => s.id);
        
        const newSales = await fetchOrdersFromIderis(settings.iderisPrivateKey, { from, to }, existingSaleIds);

        if (newSales.length > 0) {
            await saveSales(newSales);
            toast({
              title: "Painel Atualizado!",
              description: `${newSales.length} novo(s) pedido(s) foram importados.`,
            });
        } else {
             toast({ title: "Tudo certo!", description: "Seu painel já está atualizado com os últimos pedidos." });
        }
        setLastSyncTime(new Date());
    } catch (error) {
        console.error("Auto-sync failed:", error);
    } finally {
        setIsSyncing(false);
    }
  }, [isSyncing, toast]);

  useEffect(() => {
    fetchTodaysPicks();
    if (!initialSyncDone) {
        autoSyncIderis();
        setInitialSyncDone(true);
    }
  }, [fetchTodaysPicks, initialSyncDone, autoSyncIderis]);
  
  useEffect(() => {
    const intervalId = setInterval(async () => {
      console.log("Iniciando rotina de sincronização automática na página de Picking...");
      await autoSyncIderis();
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [autoSyncIderis]);

  useEffect(() => {
    const handleStorageChange = () => {
        if (localStorage.getItem('stockDataDirty') === 'true') {
            fetchTodaysPicks();
            localStorage.removeItem('stockDataDirty');
        }
    };
    window.addEventListener('focus', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('focus', handleStorageChange);
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchTodaysPicks]);
  
  useEffect(() => {
    if (foundSale && serialNumberRef.current) {
      serialNumberRef.current.focus();
    }
  }, [foundSale]);

  const handleAddSN = useCallback(async () => {
    if (!currentSN.trim() || !foundSale) return;

    setIsSearchingSN(true);
    const snToSearch = currentSN.trim();

    try {
        const item = await findInventoryItemBySN(snToSearch);
        if (!item) {
            toast({ variant: "destructive", title: "SN não encontrado", description: `O SN ${snToSearch} não foi encontrado no estoque.` });
            return;
        }

        const saleSku = (foundSale as any).item_sku;
        if (!saleSku) {
            toast({ variant: "destructive", title: "SKU do Pedido Faltando", description: "Não foi possível identificar o SKU do produto no pedido." });
            return;
        }

        const parentProduct = await findProductByAssociatedSku(saleSku);

        if (!parentProduct) {
            toast({ variant: "destructive", title: "Produto Incompatível", description: `O SKU do pedido (${saleSku}) não está associado a nenhum produto cadastrado.` });
            return;
        }

        if (item.sku !== parentProduct.sku) {
            setMismatchItem(item);
            setIsMismatchDialogOpen(true);
            return;
        }
        
        toast({
            title: "Produto Correto!",
            description: `O item ${item.name} foi adicionado ao pedido.`,
        });

        setScannedItems(prev => [...prev, item]);
        setCurrentSN('');

    } catch (error) {
        console.error("Error adding SN:", error);
        toast({ variant: "destructive", title: "Erro ao buscar SN." });
    } finally {
        setIsSearchingSN(false);
        serialNumberRef.current?.focus();
    }
  }, [currentSN, foundSale, toast]);


  const handleSNKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSN();
    }
  }

  const resetState = () => {
    setOrderNumber('');
    setFoundSale(null);
    setAssociatedProduct(null);
    setCurrentSN('');
    setScannedItems([]);
    setCountdown(null);
    if(countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    orderNumberRef.current?.focus();
  };
  
  const handleConfirmPicking = useCallback(async () => {
    if (scannedItems.length === 0 || !orderNumber || isConfirming || !foundSale) {
      return;
    }
    
    if(countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
    setIsConfirming(true);
    
    const batch = writeBatch(db);
    const logCol = collection(db, 'users', DEFAULT_USER_ID, 'picking-log');

    try {
        for (const item of scannedItems) {
            const logDocRef = doc(logCol);
            const newLogEntry: PickedItemLog = {
                ...item,
                orderNumber: (foundSale as any).order_code,
                pickedAt: new Date().toISOString(),
                logId: logDocRef.id,
            };
            batch.set(logDocRef, toFirestore(newLogEntry));

            if (!item.id.startsWith('manual-')) {
                const inventoryItemRef = doc(db, 'users', DEFAULT_USER_ID, 'inventory', item.id);
                batch.delete(inventoryItemRef);
            }
        }
        
        await batch.commit();

        toast({
            title: 'Saída Registrada com Sucesso!',
            description: `${scannedItems.length} produto(s) foram removidos para o pedido ${(foundSale as any).order_code}.`,
        });
        
        await fetchTodaysPicks();
        resetState();
    } catch (error) {
        console.error("Error during picking confirmation:", error);
        toast({ variant: 'destructive', title: 'Erro ao Confirmar', description: 'Não foi possível registrar a saída do estoque.' });
    } finally {
      setIsConfirming(false);
    }
  }, [scannedItems, orderNumber, isConfirming, toast, fetchTodaysPicks, foundSale]);


  const handleSearchByOrder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!orderNumber) {
        toast({ variant: 'destructive', title: 'Campo Obrigatório', description: 'Por favor, insira um ID ou Código de Pedido.' });
        return;
    }
    
    setIsSearchingOrder(true);
    setFoundSale(null);
    setAssociatedProduct(null);
    setScannedItems([]);
    setCurrentSN('');

    try {
        const sale = await findSaleByOrderNumber(orderNumber.trim());
        if (sale) {
            setFoundSale(sale);
            const saleSku = (sale as any).item_sku;
            if (saleSku) {
                const parentProduct = await findProductByAssociatedSku(saleSku);
                setAssociatedProduct(parentProduct);
            }
            toast({ title: 'Pedido Encontrado!' });
        } else {
            toast({
                variant: "destructive",
                title: "Pedido não encontrado",
                description: `O pedido "${orderNumber}" não foi encontrado. Sincronize os dados se for um pedido recente.`,
            });
        }
    } catch (error) {
        console.error("Error searching order:", error);
        toast({ variant: "destructive", title: "Erro ao buscar pedido." });
    } finally {
        setIsSearchingOrder(false);
    }
  };
  
  const filteredPicks = useMemo(() => {
    if (!pickSearchTerm) return todaysPicks;
    return todaysPicks.filter(pick => 
        pick.orderNumber.toLowerCase().includes(pickSearchTerm.toLowerCase())
    );
  }, [todaysPicks, pickSearchTerm]);

  const pageCount = Math.ceil(filteredPicks.length / pageSize);

  const paginatedPicks = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return filteredPicks.slice(startIndex, startIndex + pageSize);
  }, [filteredPicks, pageIndex, pageSize]);

  useEffect(() => {
    if (pageIndex >= pageCount && pageCount > 0) {
        setPageIndex(pageCount - 1);
    } else if (pageCount === 0) {
        setPageIndex(0);
    }
  }, [filteredPicks, pageIndex, pageCount]);

  const canConfirm = useMemo(() => {
      if (!foundSale || scannedItems.length === 0) return false;
      const requiredQty = (foundSale as any).item_quantity || 0;
      return scannedItems.length === requiredQty;
  }, [foundSale, scannedItems]);

  useEffect(() => {
      if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
      }

      if (countdown === null) return;

      if (countdown <= 0) {
          handleConfirmPicking();
          return;
      }

      countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => {
          if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
          }
      };
  }, [countdown, handleConfirmPicking]);


  useEffect(() => {
      if (canConfirm && autoSubmitDelay !== null && countdown === null) {
          if (!isConfirming) {
             setCountdown(autoSubmitDelay / 1000);
          }
      }
  }, [canConfirm, autoSubmitDelay, isConfirming, countdown]);


  const handleCancelAutoSubmit = () => {
    if(countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
    toast({ title: "Envio automático cancelado." });
  }

  const handleRevertPick = async (pickLog: PickedItemLog) => {
    await revertPickingAction(pickLog);
    toast({
      title: "Sucesso!",
      description: `Registro do SN ${pickLog.serialNumber} removido.`,
    });
    fetchTodaysPicks();
  };

  const handleClearTodaysLog = async () => {
      await clearLogService();
      toast({ title: "Sucesso", description: "Todos os registros de hoje foram limpos." });
      fetchTodaysPicks();
  }

  const handleSubmitForApproval = async () => {
    if (!mismatchItem || !foundSale || !user?.email) return;
    
    setIsSubmittingApproval(true);
    try {
        await createApprovalRequest({
            type: 'SKU_MISMATCH_PICKING',
            status: 'pending',
            requestedBy: user.email,
            createdAt: new Date().toISOString(),
            orderData: foundSale,
            scannedItem: mismatchItem
        });
        toast({ title: "Enviado para Aprovação", description: "A solicitação foi enviada para um administrador."});
        setCurrentSN('');
        setIsMismatchDialogOpen(false);
        setMismatchItem(null);
    } catch(e) {
        toast({ variant: 'destructive', title: "Erro ao Enviar", description: "Não foi possível enviar a solicitação." });
    } finally {
        setIsSubmittingApproval(false);
    }
  }

  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('pt-BR');

  const formatLastSyncTime = (date: Date | null): string => {
    if (!date) return 'Sincronizando pela primeira vez...';
    return `Última sincronização: ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR')}`;
  };
  
    if (isLoadingPicks) {
        return (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <Loader2 className="animate-spin" />
            <p className="ml-2">Carregando...</p>
          </div>
        );
    }

  const productNameToDisplay = associatedProduct ? associatedProduct.name : (foundSale as any)?.item_title;


  return (
    <>
    <div className="flex flex-col gap-8 p-4 md:p-8">
       <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline">Picking de Estoque</h1>
          <p className="text-muted-foreground">Registre a saída de produtos informando primeiro o pedido de venda.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            {isSyncing ? (
              <Badge variant="secondary" className="animate-pulse">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando com Ideris...
              </Badge>
            ) : (
                <Badge variant="outline" className="text-muted-foreground font-normal">
                   {formatLastSyncTime(lastSyncTime)}
                </Badge>
            )}
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Registrar Saída</CardTitle>
                            <CardDescription>Busque o pedido e depois leia os SNs dos produtos.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <Select 
                                value={autoSubmitDelay === null ? 'manual' : autoSubmitDelay.toString()}
                                onValueChange={(value) => {
                                    if (value === 'manual') {
                                        setAutoSubmitDelay(null as any);
                                    } else {
                                        setAutoSubmitDelay(parseInt(value));
                                    }
                                }}
                            >
                                <SelectTrigger className="w-[100px] h-8 text-xs">
                                    <SelectValue placeholder="Timer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manual">Manual</SelectItem>
                                    <SelectItem value="3000">3s</SelectItem>
                                    <SelectItem value="5000">5s</SelectItem>
                                    <SelectItem value="10000">10s</SelectItem>
                                    <SelectItem value="15000">15s</SelectItem>
                                    <SelectItem value="20000">20s</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleSearchByOrder} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="order-number">1. ID ou Cód. do Pedido</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="order-number" 
                                    ref={orderNumberRef}
                                    placeholder="Digite o ID ou o Cód. do pedido"
                                    value={orderNumber}
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    autoFocus
                                />
                                <Button type="submit" disabled={isSearchingOrder || !orderNumber}>
                                    {isSearchingOrder ? <Loader2 className="animate-spin" /> : <Search />}
                                </Button>
                            </div>
                        </div>
                    </form>

                    <div className="space-y-2">
                        <Label htmlFor="serial-number" className={!foundSale ? 'text-muted-foreground/50' : ''}>2. Número de Série (SN) do Produto</Label>
                        <div className='flex gap-2'>
                            <Input 
                                id="serial-number" 
                                ref={serialNumberRef}
                                placeholder="Bipe ou digite o SN e tecle Enter"
                                value={currentSN}
                                onChange={e => setCurrentSN(e.target.value)}
                                onKeyDown={handleSNKeyDown}
                                disabled={!foundSale || isSearchingSN}
                            />
                        </div>
                         {foundSale && (
                            <p className="text-sm text-muted-foreground">
                                Itens lidos: <span className="font-bold text-primary">{scannedItems.length}</span> de <span className="font-bold text-primary">{(foundSale as any).item_quantity || 0}</span>
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button 
                        className="w-full" 
                        disabled={!canConfirm || isConfirming}
                        onClick={countdown !== null ? handleCancelAutoSubmit : handleConfirmPicking}
                        variant={countdown !== null ? 'destructive' : 'default'}
                    >
                        {isConfirming ? <Loader2 className="animate-spin" /> : (
                            countdown !== null ? (
                                <>
                                <XCircle />
                                Cancelar Envio ({countdown}s)
                                </>
                            ) : (
                                <>
                                <PackageCheck />
                                Confirmar Saída do Estoque
                                </>
                            )
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Card className={!foundSale ? 'bg-muted/50 border-dashed' : 'border-primary'}>
                <CardHeader>
                    <CardTitle>Conferência do Pedido</CardTitle>
                    <CardDescription>Dados do pedido de venda.</CardDescription>
                </CardHeader>
                <CardContent>
                     {foundSale ? (
                         <div className="space-y-3 w-full">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                                    {associatedProduct ? <PackageSearch className="h-4 w-4" /> : null}
                                    Produto:
                                </span>
                                <span className="font-bold text-right">{productNameToDisplay}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-sm">SKU (Pedido):</span>
                                <span className="font-mono">{(foundSale as any).item_sku}</span>
                            </div>
                            {associatedProduct && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground text-sm">SKU (Pai):</span>
                                    <span className="font-mono text-primary font-semibold">{associatedProduct.sku}</span>
                                </div>
                            )}
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-sm">Conta:</span>
                                <span className="font-semibold">{(foundSale as any).auth_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-sm">Quantidade:</span>
                                <span className="font-semibold text-xl text-primary">{(foundSale as any).item_quantity}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10 h-full">
                            <Ticket className="h-12 w-12 mb-4" />
                            <p>Aguardando um pedido...</p>
                        </div>
                    )}
                </CardContent>
            </Card>

             <Card className={scannedItems.length === 0 ? 'bg-muted/50 border-dashed' : 'border-primary'}>
                <CardHeader className="flex justify-between items-center">
                    <div>
                        <CardTitle>Produtos Lidos</CardTitle>
                        <CardDescription>Itens do estoque que foram bipados.</CardDescription>
                    </div>
                    {scannedItems.length > 0 && (
                        <div className="flex items-center gap-1.5 text-green-600 font-semibold text-sm">
                            <span>SKU Associado</span>
                            <CheckCircle className="h-5 w-5" />
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                     {scannedItems.length > 0 ? (
                         <div className="space-y-2 w-full max-h-48 overflow-y-auto pr-2">
                           {scannedItems.map(item => (
                             <div key={item.id} className="flex justify-between items-start gap-2 p-2 rounded-md border text-sm">
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="font-mono text-xs">{item.serialNumber}</p>
                                </div>
                                <Badge variant="secondary">{item.sku}</Badge>
                            </div>
                           ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10 h-full">
                            <ScanLine className="h-12 w-12 mb-4" />
                            <p>Aguardando a leitura dos produtos...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 self-start">
                  <History className="h-5 w-5"/>
                  <div>
                      <CardTitle>
                          Resumo do Picking de Hoje
                      </CardTitle>
                       <CardDescription>Lista de todos os produtos que saíram do estoque na data de hoje.</CardDescription>
                  </div>
              </div>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-4">
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                              <Trash2 />
                              Limpar Registros de Hoje
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Limpar todos os registros de hoje?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Esta ação é irreversível e irá remover todos os registros de saída do dia. Isso NÃO estornará os itens para o estoque. Use com cuidado.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearTodaysLog}>Sim, Limpar Tudo</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar pelo pedido..."
                      className="pl-9"
                      value={pickSearchTerm}
                      onChange={(e) => setPickSearchTerm(e.target.value)}
                    />
                  </div>
                   <div className="text-sm font-semibold text-muted-foreground whitespace-nowrap bg-muted px-3 py-2 rounded-md">
                        {filteredPicks.length} registros
                   </div>
              </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border max-h-[400px] overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                            <TableHead>Horário</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nº de Série (SN)</TableHead>
                            <TableHead className="text-right">Pedido</TableHead>
                            <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingPicks ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Carregando histórico...</TableCell></TableRow>
                        ) : paginatedPicks.length > 0 ? (
                            paginatedPicks.map(item => (
                                <TableRow key={item.logId}>
                                    <TableCell className="font-medium">{formatTime(item.pickedAt)}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                    <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                                    <TableCell className="text-right font-semibold">{item.orderNumber}</TableCell>
                                    <TableCell className="text-center">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remover este registro?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação irá remover permanentemente o registro de saída do item <strong>(SN: {item.serialNumber})</strong> e o item retornará ao estoque. Você tem certeza?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRevertPick(item)}>Sim, Remover</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Nenhuma saída registrada hoje.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-muted-foreground">
                Total de {filteredPicks.length} registros.
            </div>
            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Itens por página</p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            setPageSize(Number(value));
                            setPageIndex(0);
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize.toString()} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[5, 10, 20, 50].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-sm font-medium">
                    Página {pageIndex + 1} de {pageCount > 0 ? pageCount : 1}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(0)}
                        disabled={pageIndex === 0}
                    >
                        <span className="sr-only">Primeira página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(pageIndex - 1)}
                        disabled={pageIndex === 0}
                    >
                        <span className="sr-only">Página anterior</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(pageIndex + 1)}
                        disabled={pageIndex >= pageCount - 1}
                    >
                        <span className="sr-only">Próxima página</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(pageCount - 1)}
                        disabled={pageIndex >= pageCount - 1}
                    >
                        <span className="sr-only">Última página</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
    </div>

    {isMismatchDialogOpen && mismatchItem && foundSale && (
        <AlertDialog open={isMismatchDialogOpen} onOpenChange={setIsMismatchDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive"/>
                        Alerta de Divergência de SKU
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        O produto lido não corresponde ao produto do pedido.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-around text-center">
                        <div>
                            <Label>Produto do Pedido</Label>
                            <p className="font-bold">{(foundSale as any).item_title}</p>
                            <Badge variant="secondary">SKU: {(foundSale as any).item_sku}</Badge>
                        </div>
                         <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0 mx-4"/>
                        <div>
                            <Label>Produto Lido</Label>
                            <p className="font-bold">{mismatchItem.name}</p>
                             <Badge variant="destructive">SKU: {mismatchItem.sku}</Badge>
                        </div>
                    </div>
                    <p className="text-sm text-center text-muted-foreground">
                        Deseja prosseguir e enviar esta ação para aprovação de um administrador?
                    </p>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCurrentSN('')} disabled={isSubmittingApproval}>
                        Cancelar Ação
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmitForApproval} disabled={isSubmittingApproval}>
                        {isSubmittingApproval && <Loader2 className="animate-spin mr-2"/>}
                        Enviar para Aprovação
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
    </>
  );
}
