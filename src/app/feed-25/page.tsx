'use client';

import { useActionState, useState, useEffect, useTransition, useRef, FormEvent } from 'react';
import { Bot, Database, Loader2, Wand2, CheckCircle, CircleDashed, Calendar as CalendarIcon, ClipboardCopy, Send, ArrowRight, Store, RotateCcw, Check } from 'lucide-react';

import {
  processListPipelineAction,
  type PipelineResult,
  type ProductDetail,
  type OrganizeResult,
  type StandardizeResult,
  type LookupResult
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ProductTable } from '@/components/product-table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnprocessedItemsTable } from '@/components/unprocessed-items-table';
import { Progress } from '@/components/ui/progress';
import { loadAppSettings, loadProducts } from '@/services/firestore';


const DB_STORAGE_KEY = 'productsDatabase';
const FEED_STORAGE_KEY = 'feedData';
const STORES_STORAGE_KEY = 'storesDatabase';
const API_KEY_STORAGE_KEY = 'gemini_api_key';
const MODEL_STORAGE_KEY = 'gemini_model';


type ProcessingStep = 'idle' | 'organizing' | 'standardizing' | 'lookingUp' | 'done' | 'error';

export interface FeedEntry {
    storeName: string;
    date: string;
    products: ProductDetail[];
    id: string;
}

function StepIndicator({ title, status, count }: { title: string, status: 'pending' | 'active' | 'complete', count?: number | null }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div>
                    {status === 'active' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {status === 'pending' && <CircleDashed className="h-5 w-5 text-muted-foreground" />}
                    {status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <div>
                    <p className={`font-medium ${status === 'active' ? 'text-primary' : status === 'pending' ? 'text-muted-foreground' : ''}`}>{title}</p>
                </div>
            </div>
            {status === 'complete' && count !== null && count !== undefined && (
                 <p className="text-sm text-muted-foreground">{count} itens</p>
            )}
        </div>
    )
}

function FullPipelineTab() {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(processListPipelineAction, {
    result: null,
    error: null,
  });
  
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [databaseList, setDatabaseList] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [storeName, setStoreName] = useState('');
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set date on client-side only to avoid hydration mismatch
    setDate(new Date());

    async function loadData() {
        try {
          const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
          if (savedApiKey) setApiKey(savedApiKey);
          
          const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
          if (savedModel) setModelName(savedModel);
    
          const allProducts = await loadProducts();
          if (allProducts) {
            const dbList = allProducts.map(p => `${p.name}\t${p.sku}`).join('\n');
            setDatabaseList(dbList);
          }
          const appSettings = await loadAppSettings();
          if (appSettings?.stores) {
            setAvailableStores(appSettings.stores);
          }
        } catch (error) {
          console.error("Failed to load data", error);
        }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (isPending) {
        setCurrentStep('organizing');
    }
  }, [isPending]);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPending) {
      setProgress(0);
      let targetProgress = 0;
      switch (currentStep) {
        case 'organizing': targetProgress = 15; break;
        case 'standardizing': targetProgress = 50; break;
        case 'lookingUp': targetProgress = 85; break;
      }

      timer = setInterval(() => {
        setProgress(prev => {
          if (prev < targetProgress) return prev + 1;
          clearInterval(timer);
          return prev;
        });
      }, 50);

      // Simulate step changes
      if (currentStep === 'organizing') setTimeout(() => setCurrentStep('standardizing'), 2000);
      if (currentStep === 'standardizing') setTimeout(() => setCurrentStep('lookingUp'), 4000);

    } else {
        if(state.result) {
            setProgress(100);
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } else {
            setProgress(0);
        }
    }
    return () => clearInterval(timer);
  }, [isPending, currentStep, state.result]);

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Erro no Processamento',
        description: state.error,
      });
      setCurrentStep('error');
      setProgress(0);
    }
    if (state.result) {
        setCurrentStep('done');
        setProgress(100);
        if (state.result.standardizedList.trim() === '' && state.result.unprocessedItems.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Nenhum item para buscar',
                description: 'Nenhum item foi padronizado com sucesso. Verifique os itens não processados abaixo.',
              });
        }
    }
  }, [state, toast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copiado!', description: 'A lista final foi copiada para a área de transferência.' });
    }, (err) => {
      toast({ variant: 'destructive', title: 'Erro ao copiar', description: 'Não foi possível copiar a lista.' });
    });
  };

  const sendToFeed = () => {
    if (!state.result || !storeName) {
        toast({
            variant: 'destructive',
            title: 'Erro',
            description: 'É necessário ter um resultado processado e um nome de loja para enviar ao Feed.',
        });
        return;
    }

    try {
        const formattedDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        
        const newEntry: FeedEntry = {
            storeName,
            date: formattedDate,
            products: state.result.details,
            id: `${storeName}-${formattedDate}`,
        };

        const existingFeedData = localStorage.getItem(FEED_STORAGE_KEY);
        let feed: FeedEntry[] = existingFeedData ? JSON.parse(existingFeedData) : [];
        
        // Remove any existing entry for the same store and date
        const updatedFeed = feed.filter(entry => !(entry.storeName === storeName && entry.date === formattedDate));
        
        updatedFeed.push(newEntry);
        localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(updatedFeed));

        toast({
            title: 'Enviado para o Feed!',
            description: `A lista da loja ${storeName} foi salva. Se já existia uma para esta data, ela foi substituída.`,
        });

    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Erro ao Salvar',
            description: 'Não foi possível salvar os dados para o Feed no seu navegador.',
        });
    }
  };

  const organizedCount = state.result?.organizedList?.split('\n').filter(Boolean).length ?? null;
  const standardizedCount = state.result?.standardizedList?.split('\n').filter(Boolean).length ?? null;
  const foundCount = state.result?.details?.length ?? null;
  const unprocessedItems = state.result?.unprocessedItems || [];

  const getStepStatus = (step: ProcessingStep): 'pending' | 'active' | 'complete' => {
    if (state.result) return 'complete'; // All complete when done
    if (currentStep === step) return 'active';
    const stepOrder: ProcessingStep[] = ['organizing', 'standardizing', 'lookingUp'];
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);

    if (currentStepIndex > stepIndex) return 'complete';

    return 'pending';
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Processamento de Lista Completo</CardTitle>
                <CardDescription>
                Cole uma lista de produtos em texto livre. A IA irá organizar, padronizar e buscar os produtos no seu banco de dados em um único fluxo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-4">
                <input type="hidden" name="databaseList" value={databaseList} />
                <input type="hidden" name="apiKey" value={apiKey} />
                <input type="hidden" name="modelName" value={modelName} />
                <input type="hidden" name="listDate" value={date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : ''} />
                <input type="hidden" name="storeName" value={storeName} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="storeName" className="text-sm font-medium mb-2 block">Nome da Loja (Obrigatório)</label>
                        <Select onValueChange={setStoreName} value={storeName} disabled={isPending}>
                            <SelectTrigger id="storeName">
                                <SelectValue placeholder="Selecione uma loja" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStores.length > 0 ? availableStores.map(store => (
                                    <SelectItem key={store} value={store}>{store}</SelectItem>
                                )) : (
                                    <div className="p-2 text-sm text-muted-foreground">Nenhuma loja cadastrada.</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label htmlFor="listDate" className="text-sm font-medium mb-2 block">Data da Lista</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                                disabled={isPending || !date}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : <span>Escolha uma data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                                locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <Textarea
                    name="productList"
                    placeholder="Cole a lista de produtos aqui..."
                    className="min-h-[200px] text-sm bg-white"
                    disabled={isPending}
                />
                <Button type="submit" disabled={isPending || !databaseList || !storeName}>
                    {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <Bot className="mr-2 h-4 w-4" />
                    )}
                    Processar Lista Completa
                </Button>
                </form>
            </CardContent>
        </Card>

        {(isPending || state.result) && (
            <Card ref={resultRef}>
                <CardHeader>
                    <CardTitle className="font-headline text-xl">
                      {state.result ? "Processamento Concluído" : "Processando com IA"}
                    </CardTitle>
                    <CardDescription>
                      {state.result ? "A análise foi finalizada com sucesso." : "Aguarde um momento enquanto executamos todas as etapas de análise..."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <StepIndicator title="1. Organizando e limpando a lista" status={getStepStatus('organizing')} count={organizedCount} />
                        <StepIndicator title="2. Padronizando os dados" status={getStepStatus('standardizing')} count={standardizedCount}/>
                        <StepIndicator title="3. Buscando no Banco de Dados" status={getStepStatus('lookingUp')} count={foundCount} />
                    </div>
                    {(isPending || state.result) && progress > 0 && (
                        <div className="pt-2">
                           <Progress value={progress} className="w-full" />
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

        {state.result && !isPending && (
          <div className="space-y-6">
            <Accordion type="single" collapsible className="w-full space-y-4" defaultValue='final'>
                
                {unprocessedItems.length > 0 && (
                  <UnprocessedItemsTable items={unprocessedItems} />
                )}

                <Card>
                     <AccordionItem value="details" className="border-b-0">
                        <AccordionTrigger className="p-6 hover:no-underline">
                            <CardHeader className="p-0 text-left">
                                <CardTitle className="font-headline text-xl">Resultados Intermediários</CardTitle>
                                <CardDescription>Expanda para ver os dados de cada etapa do processamento.</CardDescription>
                            </CardHeader>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 space-y-4">
                            <div>
                                <h3 className="font-semibold mb-2">1. Lista Organizada ({organizedCount} itens)</h3>
                                <Textarea readOnly value={state.result.organizedList} className="min-h-[200px] whitespace-pre-wrap bg-white/50 text-xs" />
                            </div>
                             <div>
                                <h3 className="font-semibold mb-2">2. Lista Padronizada ({standardizedCount} itens)</h3>
                                <Textarea readOnly value={state.result.standardizedList} className="min-h-[200px] whitespace-pre-wrap bg-white/50 text-xs" />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Card>

                {state.result.details.length > 0 && (
                    <Card>
                        <AccordionItem value="final" className="border-b-0">
                            <AccordionTrigger className="p-6 hover:no-underline">
                                <CardHeader className="p-0 text-left">
                                    <CardTitle className="font-headline text-xl">Lista Final Formatada (Pronta para Salvar)</CardTitle>
                                    <CardDescription>Este é o resultado final, formatado em texto para ser copiado ou enviado ao Feed.</CardDescription>
                                </CardHeader>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 space-y-4">
                                <div className="relative">
                                    <Textarea 
                                        readOnly 
                                        value={state.result.finalFormattedList} 
                                        className="min-h-[200px] whitespace-pre-wrap bg-white/50 text-xs font-mono" 
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-7 w-7"
                                        onClick={() => copyToClipboard(state.result.finalFormattedList)}
                                    >
                                        <ClipboardCopy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button onClick={sendToFeed} disabled={!storeName}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Enviar para o Feed
                                </Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                )}
            </Accordion>
            
            {state.result.details.length > 0 && (
                <ProductTable products={state.result.details} brands={[]} />
            )}
          </div>
        )}
    </div>
  )
}


export default function ListaPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        <FullPipelineTab />
      </main>
    </div>
  );
}
