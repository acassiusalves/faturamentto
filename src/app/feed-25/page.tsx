

'use client';

import { useState, useEffect, useMemo, useActionState, useTransition, useRef, useCallback } from 'react';
import { Bot, Database, Loader2, Wand2, CheckCircle, CircleDashed, ArrowRight, Store, RotateCcw, Check, Pencil, Save, ExternalLink, Sparkles, ArrowDown } from 'lucide-react';
import Link from 'next/link';

import {
  organizeListAction,
  standardizeListAction,
  lookupProductsAction,
  savePromptAction,
} from '@/app/actions';
import type { OrganizeResult, StandardizeListOutput, LookupResult, FeedEntry, UnprocessedItem, ProductDetail } from '@/lib/types'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ProductTable } from '@/components/product-table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { UnprocessedItemsTable } from '@/components/unprocessed-items-table';
import { Progress } from '@/components/ui/progress';
import { loadAppSettings, loadProducts, saveFeedEntry, loadAllFeedEntries } from '@/services/firestore';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { useAuth } from '@/context/auth-context';


const DB_STORAGE_KEY = 'productsDatabase';
const FEED_STORAGE_KEY = 'feedData';
const STORES_STORAGE_KEY = 'storesDatabase';


const DEFAULT_ORGANIZE_PROMPT = `Você é um assistente de organização de dados especialista em listas de produtos de fornecedores. Sua tarefa é pegar uma lista de produtos em texto bruto, não estruturado e com múltiplas variações, e organizá-la de forma limpa e individualizada.

**LISTA BRUTA DO FORNECEDOR:**
'''
{{{productList}}}
'''

**REGRAS DE ORGANIZAÇÃO:**
1.  **Um Produto Por Linha:** A regra principal é identificar cada produto e suas variações. Se um item como "iPhone 13" tem duas cores (Azul e Preto) listadas, ele deve ser transformado em duas linhas separadas na saída.
2.  **Agrupamento por Variação:** Fique atento a padrões onde um item principal tem várias cores ou preços listados juntos. Crie uma linha separada para cada combinação de produto/variação.
3.  **Extração de Detalhes:** Para cada linha, extraia os detalhes que conseguir identificar: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor e Preço.
4.  **Limpeza Geral:** Remova qualquer informação desnecessária: saudações ("Bom dia"), emojis, formatação excessiva (ex: "---"), ou palavras de marketing que não são essenciais ("Qualidade Premium", "Oportunidade").
5.  **Formato de Quantidade:** Padronize a quantidade para o formato "1x " no início de cada linha. Se nenhuma quantidade for mencionada, assuma 1.

**EXEMPLO DE ENTRADA:**
'''
Bom dia! Segue a lista:
- 2x IPHONE 15 PRO MAX 256GB - AZUL/PRETO - 5.100,00
- SAMSUNG GALAXY S24 ULTRA 512GB, 12GB RAM, cor Creme - 5.100,00
- 1x POCO X6 5G 128GB/6GB RAM
'''

**EXEMPLO DE SAÍDA ESPERADA:**
'''json
{
    "organizedList": [
        "2x IPHONE 15 PRO MAX 256GB - AZUL - 5.100,00",
        "2x IPHONE 15 PRO MAX 256GB - PRETO - 5.100,00",
        "1x SAMSUNG GALAXY S24 ULTRA 512GB, 12GB RAM, cor Creme - 5.100,00",
        "1x POCO X6 5G 128GB/6GB RAM"
    ]
}
'''

Apenas retorne o JSON com a chave 'organizedList' contendo um array de strings, onde cada string é uma variação de produto em sua própria linha.
`;

const DEFAULT_STANDARDIZE_PROMPT = `Você é um especialista em padronização de dados de produtos. Sua tarefa é analisar a lista de produtos já organizada e reescrevê-la em um formato padronizado e estruturado, focando apenas em marcas específicas.

    **LISTA ORGANIZADA PARA ANÁLISE:**
    '''
    {{{organizedList}}}
    '''

    **REGRAS DE PADRONIZAÇÃO:**
    1.  **Foco em Marcas Principais:** Processe e padronize **APENAS** produtos que sejam claramente das marcas **Xiaomi, Realme, Motorola ou Samsung**.
    2.  **Ignorar Outras Marcas:** Se um produto não pertencer a uma das quatro marcas acima, ele deve ser adicionado à lista 'unprocessedItems' com o motivo "Marca não prioritária".
    3.  **Extração de Componentes:** Para cada linha de uma marca prioritária, identifique e extraia: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor, Rede (4G/5G, se houver) e Preço.
    4.  **Ordem Estrita:** Reorganize os componentes extraídos para seguir EXATAMENTE esta ordem: \`Marca Modelo Armazenamento Global Memoria Cor Rede Preço\`.
    5.  **Formatação de Memória:** Garanta que "GB" ou "TB" esteja associado ao armazenamento e que a memória RAM seja identificada (ex: "8GB RAM"). Formatos como "8/256GB" significam "8GB RAM" e "256GB" de armazenamento.
    6.  **Omissão de Rede:** Se a conectividade (4G ou 5G) não for mencionada, omita essa informação. Não assuma um valor padrão.
    7.  **Manutenção do Preço:** O preço DEVE ser mantido no final de cada linha padronizada.
    8.  **Limpeza de Dados:** Após a padronização, remova qualquer informação extra que não se encaixe na nova estrutura (por exemplo, "6/128GB", "Versão Global", "Americano A+", "/") para limpar a descrição do produto.
    9.  **Tratamento de Erros:** Se uma linha (de uma marca prioritária) não puder ser padronizada por outro motivo (faltando preço, formato confuso), adicione-a à lista 'unprocessedItems' com uma breve justificativa.

    **EXEMPLO DE ENTRADA:**
    '''
    1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00
    1x REDMI NOTE 14 PRO 5G 8/256GB - PRETO - 1.235,00
    1x Produto com defeito sem preço
    1x SAMSUNG GALAXY S23 128GB PRETO 5G - 3500.00
    '''

    **EXEMPLO DE SAÍDA ESPERADA:**
    '''json
    {
        "standardizedList": [
            "Redmi Note 14 Pro 256GB Global 8GB RAM Preto 5G 1.235,00",
            "Samsung Galaxy S23 128GB Global 8GB RAM Preto 5G 3500.00"
        ],
        "unprocessedItems": [
        {
            "line": "1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00",
            "reason": "Marca não prioritária"
        },
        {
            "line": "1x Produto com defeito sem preço",
            "reason": "Faltando preço"
        }
        ]
    }
    '''

    Execute a análise e gere a lista padronizada e a lista de itens não processados. A saída deve ser um JSON válido.
    `;

const DEFAULT_LOOKUP_PROMPT = `Você é um sistema avançado de busca e organização para um e-commerce de celulares. Sua tarefa principal é converter CADA linha da 'Lista Padronizada' de entrada em um objeto JSON na saída, cruzando as informações com o 'Banco de Dados' para encontrar o SKU correto.

        **LISTA PADRONIZADA (Entrada para conversão):**
        '''
        {{{productList}}}
        '''

        **BANCO DE DADOS (Fonte para consulta de SKU):**
        '''
        {{{databaseList}}}
        '''

        **REGRAS DE PROCESSAMENTO E CONVERSÃO:**
        1.  **REGRA CRÍTICA - UM-PARA-UM:** Para CADA linha na 'Lista Padronizada' de entrada, você DEVE gerar exatamente um objeto JSON correspondente na saída. A contagem de itens na entrada e na saída (array 'details') deve ser IDÊNTICA. Não adicione, duplique ou omita itens.
        2.  **Correspondência Inteligente:** Para cada item na 'Lista Padronizada', encontre a correspondência mais próxima no 'Banco de Dados'.
        3.  **Foco nos Componentes-Chave:** Para a correspondência, priorize os seguintes componentes: **Modelo, RAM e Armazenamento**. Variações pequenas no nome (como "/") podem ser ignoradas se estes componentes forem idênticos.
        4.  **Regra de Conectividade Padrão:**
            *   Se a 'Lista Padronizada' não especificar "4G" ou "5G", assuma **4G** como padrão ao procurar no 'Banco de Dados'.
            *   Se houver dois produtos idênticos no 'Banco de Dados' (um 4G e outro 5G), e a lista de entrada não especificar, priorize a versão **4G**. A versão 5G só deve ser escolhida se "5G" estiver explicitamente na linha do produto de entrada.
        5.  **Extração de Preço:** O preço de custo (\`costPrice\`) deve ser o valor numérico extraído do final de cada linha da 'Lista Padronizada'. Mantenha o formato original do número (com pontos e vírgulas). O resultado para costPrice deve ser uma string. Exemplos: "R$ 1.234,56" se torna "1.234,56". "R$ 1.130" se torna "1.130". "R$ 545.00" se torna "545.00".
        6.  **Formato de Saída (JSON):** A saída deve ser um array de objetos JSON dentro da chave 'details'. Cada objeto deve conter:
            *   \`sku\`: O código do produto do 'Banco de Dados'. Se não houver uma correspondência com alta confiança, use a string **"SEM CÓDIGO"**.
            *   \`name\`: O nome completo e oficial do produto, **exatamente como está no 'Banco de Dados'**. Se não for encontrado, repita o nome original da 'Lista Padronizada'.
            *   \`costPrice\`: O preço de custo extraído como uma string, mantendo o formato original.
        7.  **Tratamento de Listas Longas:** Se a 'Lista Padronizada' for muito extensa para processar completamente, processe o máximo de itens que puder, mas garanta que a saída JSON seja sempre um arquivo válido e bem-formado, sem objetos cortados pela metade. É melhor retornar menos itens do que um JSON quebrado.

        **REGRAS DE ORGANIZAÇÃO DO RESULTADO FINAL:**
        1.  **Agrupamento por Marca:** Organize o array 'details' final agrupando os produtos por marca na seguinte ordem de prioridade: **Xiaomi, Realme, Motorola, Samsung**.
        2.  **Ignorar Outras Marcas:** Produtos de marcas que não sejam uma das quatro mencionadas acima devem ser completamente ignorados e não devem aparecer no resultado final.
        3.  **Itens "SEM CÓDIGO":** Todos os produtos para os quais não foi encontrado um SKU (ou seja, \`sku\` é "SEM CÓDIGO") devem ser movidos para o **final da lista**, após todas as marcas.

        **EXEMPLO DE SAÍDA ESPERADA:**
        '''json
        {
          "details": [
            { "sku": "#XMS12P256A", "name": "Xiaomi Mi 12S 256GB 8GB RAM 5G - Versão Global", "costPrice": "3.100,00" },
            { "sku": "#RMGTN256P", "name": "Realme GT Neo 256GB 12GB RAM 5G - Preto", "costPrice": "2.800" },
            { "sku": "#MTG2264A", "name": "Motorola Moto G22 64GB 4GB RAM 4G - Azul", "costPrice": "980.00" },
            { "sku": "#SMA53128V", "name": "Samsung Galaxy A53 128GB 8GB RAM 5G - Verde", "costPrice": "1500.00" },
            { "sku": "SEM CÓDIGO", "name": "Tablet Desconhecido 64GB 4GB RAM 4G", "costPrice": "630,00" }
          ]
        }
        '''

        Execute a conversão, aplique todas as regras de negócio e de organização, e gere o JSON final completo.
        `;


export default function FeedPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [databaseList, setDatabaseList] = useState('');
    const [isProcessing, startProcessingTransition] = useTransition();
    const [progress, setProgress] = useState(0);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Form inputs
    const [initialProductList, setInitialProductList] = useState('');
    const [storeName, setStoreName] = useState('');
    const [allAvailableStores, setAllAvailableStores] = useState<string[]>([]);
    const [date, setDate] = useState<Date | undefined>();
    const [geminiApiKey, setGeminiApiKey] = useState('');

    // Model selection state
    const [organizeModel, setOrganizeModel] = useState('gemini-1.5-flash-latest');
    const [standardizeModel, setStandardizeModel] = useState('gemini-1.5-flash-latest');
    const [lookupModel, setLookupModel] = useState('gemini-1.5-flash-latest');

    // States for each step's result
    const [step1Result, setStep1Result] = useState<OrganizeResult | null>(null);
    const [step2Result, setStep2Result] = useState<StandardizeListOutput | null>(null);
    const [step3Result, setStep3Result] = useState<LookupResult | null>(null);
    
    // States for prompt overrides
    const [organizePrompt, setOrganizePrompt] = useState(DEFAULT_ORGANIZE_PROMPT);
    const [standardizePrompt, setStandardizePrompt] = useState(DEFAULT_STANDARDIZE_PROMPT);
    const [lookupPrompt, setLookupPrompt] = useState(DEFAULT_LOOKUP_PROMPT);

    // State for saving prompts
    const [savePromptState, handleSavePrompt] = useActionState(savePromptAction, { error: null, success: false });
    const [isSavingPrompt, startSavingPromptTransition] = useTransition();
    const [existingFeedEntries, setExistingFeedEntries] = useState<FeedEntry[]>([]);

    
    useEffect(() => {
        // Set date on client-side only to avoid hydration mismatch
        setDate(new Date());
        async function loadData() {
            try {
              const allProducts = await loadProducts();
              if (allProducts) {
                const dbList = allProducts.map(p => `${p.name}\t${p.sku}`).join('\n');
                setDatabaseList(dbList);
              }
              const appSettings = await loadAppSettings();
              if (appSettings) {
                setAllAvailableStores(appSettings.stores || []);
                setGeminiApiKey(appSettings.geminiApiKey || '');
                if(appSettings.organizePrompt) setOrganizePrompt(appSettings.organizePrompt);
                if(appSettings.standardizePrompt) setStandardizePrompt(appSettings.standardizePrompt);
                if(appSettings.lookupPrompt) setLookupPrompt(appSettings.lookupPrompt);
              }
              const feedEntries = await loadAllFeedEntries();
              setExistingFeedEntries(feedEntries);

            } catch (error) {
              console.error("Failed to load data", error);
            }
        }
        loadData();
    }, []);

    const availableStoresForDate = useMemo(() => {
        if (!date) return allAvailableStores;
        const selectedDateStr = format(date, 'yyyy-MM-dd');
        const storesWithEntryForDate = new Set(
            existingFeedEntries
                .filter(entry => entry.date === selectedDateStr)
                .map(entry => entry.storeName)
        );
        return allAvailableStores.filter(store => !storesWithEntryForDate.has(store));
    }, [allAvailableStores, existingFeedEntries, date]);

    useEffect(() => {
        if(savePromptState.error) {
            toast({ variant: 'destructive', title: 'Erro ao Salvar Prompt', description: savePromptState.error });
        } else if (savePromptState.success) {
            toast({ title: 'Prompt Salvo!', description: 'O novo prompt será usado como padrão.' });
        }
    }, [savePromptState, toast])


    const handleRestart = () => {
        setInitialProductList('');
        setStep1Result(null);
        setStep2Result(null);
        setStep3Result(null);
        setStoreName('');
        setDate(new Date());
        setProgress(0);
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        toast({
            title: "Processo Reiniciado",
            description: "Você pode começar uma nova análise."
        })
    }
    
    const runStep = useCallback(async (
        stepAction: (prevState: any, formData: FormData) => Promise<any>,
        formData: FormData,
        onSuccess: (result: any) => void,
        onError: (message: string) => void
    ) => {
        const result = await stepAction({ result: null, error: null }, formData);
        if (result.error) {
            onError(result.error);
            throw new Error(result.error); // Stop the chain on error
        }
        onSuccess(result.result);
        return result.result;
    }, []);
    
    const animateProgress = (start: number, end: number, duration: number) => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        const startTime = Date.now();
        
        progressIntervalRef.current = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progressFraction = elapsedTime / duration;
            const newProgress = start + (end - start) * Math.min(progressFraction, 1);
            
            setProgress(newProgress);
            
            if (progressFraction >= 1) {
                if(progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
        }, 16); // ~60fps
    };

    const handleFullProcess = () => {
        startProcessingTransition(async () => {
            setStep1Result(null);
            setStep2Result(null);
            setStep3Result(null);

            try {
                // Step 1
                animateProgress(0, 33, 1500);
                const organizeFormData = new FormData();
                organizeFormData.append('productList', initialProductList);
                organizeFormData.append('prompt_override', organizePrompt);
                organizeFormData.append('apiKey', geminiApiKey);
                organizeFormData.append('modelName', organizeModel);
                const step1Res = await runStep(organizeListAction, organizeFormData, setStep1Result, (error) => 
                    toast({ variant: 'destructive', title: 'Erro no Passo 1 (Organizar)', description: error })
                );
                setProgress(33);

                // Step 2
                animateProgress(33, 66, 1500);
                const standardizeFormData = new FormData();
                standardizeFormData.append('organizedList', step1Res.organizedList.join('\n'));
                standardizeFormData.append('prompt_override', standardizePrompt);
                standardizeFormData.append('apiKey', geminiApiKey);
                standardizeFormData.append('modelName', standardizeModel);
                const step2Res = await runStep(standardizeListAction, standardizeFormData, setStep2Result, (error) => 
                    toast({ variant: 'destructive', title: 'Erro no Passo 2 (Padronizar)', description: error })
                );
                setProgress(66);

                // Step 3
                if (step2Res.standardizedList && step2Res.standardizedList.length > 0) {
                    animateProgress(66, 100, 1500);
                    const lookupFormData = new FormData();
                    lookupFormData.append('productList', step2Res.standardizedList.join('\n'));
                    lookupFormData.append('databaseList', databaseList);
                    lookupFormData.append('prompt_override', lookupPrompt);
                    lookupFormData.append('apiKey', geminiApiKey);
                    lookupFormData.append('modelName', lookupModel);
                    await runStep(lookupProductsAction, lookupFormData, setStep3Result, (error) => 
                        toast({ variant: 'destructive', title: 'Erro no Passo 3 (Buscar)', description: error })
                    );
                }
                setProgress(100);
                 if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                }

            } catch (error) {
                setProgress(0);
                 if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                }
                console.error("Full process failed:", error);
            }
        });
    };

    const handleOrganize = () => {
        startProcessingTransition(async () => {
            setStep1Result(null);
            setStep2Result(null);
            setStep3Result(null);
            setProgress(0);
             if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            animateProgress(0, 100, 1500);
            const formData = new FormData();
            formData.append('productList', initialProductList);
            formData.append('prompt_override', organizePrompt);
            formData.append('apiKey', geminiApiKey);
            formData.append('modelName', organizeModel);
            const result = await organizeListAction({ result: null, error: null }, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao Organizar', description: result.error });
                setProgress(0);
            }
            setStep1Result(result.result);
            setProgress(100);
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        });
    };

    const handleStandardize = () => {
        if (!step1Result?.organizedList) return;
        startProcessingTransition(async () => {
            setStep2Result(null);
            setStep3Result(null);
            setProgress(0);
             if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            animateProgress(0, 100, 1500);
            const formData = new FormData();
            formData.append('organizedList', step1Result.organizedList.join('\n'));
            formData.append('prompt_override', standardizePrompt);
            formData.append('apiKey', geminiApiKey);
            formData.append('modelName', standardizeModel);
            const result = await standardizeListAction({ result: null, error: null }, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao Padronizar', description: result.error });
                setProgress(0);
            }
            setStep2Result(result.result);
            setProgress(100);
             if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        });
    };

    const handleLookup = () => {
        if (!step2Result?.standardizedList) return;
        startProcessingTransition(async () => {
            setStep3Result(null);
            setProgress(0);
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            animateProgress(0, 100, 1500);
            const formData = new FormData();
            formData.append('productList', step2Result.standardizedList.join('\n'));
            formData.append('databaseList', databaseList);
            formData.append('prompt_override', lookupPrompt); // Aqui passamos o prompt
            formData.append('apiKey', geminiApiKey);
            formData.append('modelName', lookupModel);
            const result = await lookupProductsAction({ result: null, error: null }, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao Buscar', description: result.error });
                setProgress(0);
            }
            setStep3Result(result.result);
            setProgress(100);
             if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        });
    };
    

    const sendToFeed = async () => {
        if (!step3Result || !storeName) {
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
                products: step3Result.details,
                id: `${storeName}-${formattedDate}`,
            };
            
            await saveFeedEntry(newEntry);
    
            toast({
                title: 'Enviado para o Feed!',
                description: `A lista da loja ${storeName} foi salva. Se já existia uma para esta data, ela foi substituída.`,
            });
            handleRestart();
    
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Salvar',
                description: 'Não foi possível salvar os dados para o Feed.',
            });
        }
      };

      const getStepIcon = (isProcessing: boolean, result: any, currentProgress: number, stepStart: number, stepEnd: number) => {
        if (isProcessing && currentProgress > stepStart && currentProgress < stepEnd) {
            return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
        }
        if (result) return <CheckCircle className="h-5 w-5 text-green-500" />;
        return <CircleDashed className="h-5 w-5 text-muted-foreground" />;
      };
      
      const onSavePrompt = (promptKey: 'organizePrompt' | 'standardizePrompt' | 'lookupPrompt', promptValue: string) => {
          startSavingPromptTransition(() => {
            const formData = new FormData();
            formData.append('promptKey', promptKey);
            formData.append('promptValue', promptValue);
            handleSavePrompt(formData);
          });
      };


    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <div className="flex justify-end items-center gap-4">
                <Button variant="ghost" asChild>
                    <Link href="/feed-25/lista">
                       Lista
                       <ExternalLink className="ml-2 h-4 w-4"/>
                    </Link>
                </Button>
                <Button variant="ghost" onClick={handleRestart}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Recomeçar
                </Button>
            </div>
            {/* Step 1: Organize */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        {getStepIcon(isProcessing, step1Result, progress, 0, 33)}
                        <div>
                            <CardTitle className="font-headline text-xl">Passo 1: Organizar Lista</CardTitle>
                            <CardDescription>Cole o texto bruto da lista de produtos.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Textarea
                            value={initialProductList}
                            onChange={(e) => setInitialProductList(e.target.value)}
                            placeholder="Cole a lista de produtos aqui..."
                            className="min-h-[150px] bg-white"
                        />
                         <div className="flex items-center gap-4">
                            <Button onClick={handleOrganize} disabled={!initialProductList || isProcessing}>
                                {isProcessing && !step1Result ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Organizar
                            </Button>
                             <Button onClick={handleFullProcess} disabled={!initialProductList || isProcessing} variant="outline">
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-amber-500" />}
                                Fluxo Completo
                            </Button>
                             <Select value={organizeModel} onValueChange={setOrganizeModel}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Selecionar Modelo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem>
                                    <SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {user?.role === 'admin' && (
                            <Accordion type="single" collapsible>
                              <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    <div className="flex justify-between items-center w-full pr-2">
                                      <span className="flex items-center"><Pencil className="mr-2 h-4 w-4" /> Editar Instrução (Prompt) da IA</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-2">
                                  <Textarea value={organizePrompt} onChange={(e) => setOrganizePrompt(e.target.value)} rows={15} className="text-xs" />
                                  <Button size="sm" onClick={() => onSavePrompt('organizePrompt', organizePrompt)} disabled={isSavingPrompt}>
                                    {isSavingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Prompt
                                  </Button>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                        )}
                        {isProcessing && progress > 0 && progress < 33 && (
                            <div className="flex items-center gap-4 pt-2">
                                <Progress value={(progress / 33) * 100} className="w-full" />
                                <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            
            <div className="flex justify-center my-[-1rem]">
                <div className="h-8 w-px bg-border-strong mx-auto" style={{
                    height: (step1Result) ? '2rem' : '0',
                    borderRight: '2px dashed hsl(var(--border))',
                    opacity: (step1Result) ? 1 : 0,
                    transition: 'height 0.3s ease, opacity 0.3s ease',
                }}></div>
            </div>


            {step1Result && (
                <>
                    {/* Step 2: Standardize */}
                    <Accordion type="single" collapsible className="w-full" defaultValue='item-1'>
                        <AccordionItem value="item-1" className="border-b-0">
                            <Card>
                                <AccordionTrigger className="p-0 hover:no-underline w-full">
                                <CardHeader className="flex-1 w-full">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            {getStepIcon(isProcessing, step2Result, progress, 33, 66)}
                                            <div>
                                                <CardTitle className="font-headline text-xl text-left">Passo 2: Padronizar Lista</CardTitle>
                                                <CardDescription className="text-left">A lista organizada abaixo será usada para padronização.</CardDescription>
                                            </div>
                                        </div>
                                         <div className="flex items-center gap-4">
                                             <div className="w-40 space-y-1">
                                                 <span className="text-sm font-semibold">{step1Result.organizedList.length} Produtos</span>
                                                  {((isProcessing && progress >= 33) || step2Result) ? (
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={isProcessing && progress < 66 ? ((progress - 33) / 33) * 100 : 100} className="w-full"/>
                                                        <span className="text-sm font-medium text-muted-foreground">{Math.round(isProcessing && progress < 66 ? progress : 66)}%</span>
                                                    </div>
                                                  ) : null}
                                             </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6">
                                    <div className="space-y-4">
                                        <Textarea
                                            readOnly
                                            value={step1Result.organizedList.join('\n') || ''}
                                            className="min-h-[150px] bg-white/50 text-xs"
                                        />
                                        <div className="flex items-center gap-4">
                                            <Button onClick={handleStandardize} disabled={isProcessing}>
                                                {isProcessing && !step2Result ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                                                Padronizar
                                            </Button>
                                             <Select value={standardizeModel} onValueChange={setStandardizeModel}>
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue placeholder="Selecionar Modelo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem>
                                                    <SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {user?.role === 'admin' && (
                                        <Accordion type="single" collapsible>
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger>
                                                <div className="flex justify-between items-center w-full pr-2">
                                                    <span className="flex items-center"><Pencil className="mr-2 h-4 w-4" /> Editar Instrução (Prompt) da IA</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-2">
                                            <Textarea value={standardizePrompt} onChange={(e) => setStandardizePrompt(e.target.value)} rows={15} className="text-xs" />
                                            <Button size="sm" onClick={() => onSavePrompt('standardizePrompt', standardizePrompt)} disabled={isSavingPrompt}>
                                                {isSavingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Salvar Prompt
                                            </Button>
                                            </AccordionContent>
                                        </AccordionItem>
                                        </Accordion>
                                        )}
                                    </div>
                                </AccordionContent>
                            </Card>
                         </AccordionItem>
                     </Accordion>
                </>
            )}
            
            {step2Result?.unprocessedItems && step2Result.unprocessedItems.length > 0 && (
                <UnprocessedItemsTable items={step2Result.unprocessedItems} />
            )}
            
             <div className="flex justify-center my-[-1rem]">
                 <div className="h-8 w-px bg-border-strong mx-auto" style={{
                    height: (step2Result) ? '2rem' : '0',
                    borderRight: '2px dashed hsl(var(--border))',
                    opacity: (step2Result) ? 1 : 0,
                    transition: 'height 0.3s ease, opacity 0.3s ease',
                }}></div>
            </div>

            {step2Result?.standardizedList && (
                 <>
                    {/* Step 3: Lookup */}
                     <Accordion type="single" collapsible className="w-full" defaultValue='item-1'>
                        <AccordionItem value="item-1" className="border-b-0">
                            <Card>
                                <AccordionTrigger className="p-0 hover:no-underline w-full">
                                    <CardHeader className="flex-1 w-full">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-4">
                                                {getStepIcon(isProcessing, step3Result, progress, 66, 100)}
                                                <div>
                                                    <CardTitle className="font-headline text-xl text-left">Passo 3: Buscar no Banco de Dados</CardTitle>
                                                    <CardDescription className="text-left">A lista padronizada abaixo será cruzada com seu banco de dados.</CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-40 space-y-1">
                                                    <span className="text-sm font-semibold">{step2Result.standardizedList.length} Produtos</span>
                                                    {((isProcessing && progress >= 66) || step3Result) ? (
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={isProcessing && progress < 100 ? ((progress - 66) / 34) * 100 : 100} className="w-full" />
                                                            <span className="text-sm font-medium text-muted-foreground">{Math.round(isProcessing && progress < 100 ? progress : 100)}%</span>
                                                        </div>
                                                     ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6">
                                    <div className="space-y-4">
                                        <Textarea
                                            readOnly
                                            value={step2Result.standardizedList.join('\n') || ''}
                                            className="min-h-[150px] bg-white/50 text-xs"
                                        />
                                        <div className="flex items-center gap-4">
                                            <Button onClick={handleLookup} disabled={!databaseList || isProcessing}>
                                                {isProcessing && !step3Result ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                                                Buscar Produtos
                                            </Button>
                                             <Select value={lookupModel} onValueChange={setLookupModel}>
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue placeholder="Selecionar Modelo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem>
                                                    <SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {user?.role === 'admin' && (
                                        <Accordion type="single" collapsible>
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger>
                                            <div className="flex justify-between items-center w-full pr-2">
                                                <span className="flex items-center"><Pencil className="mr-2 h-4 w-4" /> Editar Instrução (Prompt) da IA</span>
                                            </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-2">
                                            <Textarea value={lookupPrompt} onChange={(e) => setLookupPrompt(e.target.value)} rows={15} className="text-xs" />
                                            <Button size="sm" onClick={() => onSavePrompt('lookupPrompt', lookupPrompt)} disabled={isSavingPrompt}>
                                                {isSavingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Salvar Prompt
                                            </Button>
                                            </AccordionContent>
                                        </AccordionItem>
                                        </Accordion>
                                        )}
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>
                </>
            )}

            {step3Result && (
                <>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Check className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <CardTitle className="font-headline text-xl">Passo 4: Salvar no Feed</CardTitle>
                                    <CardDescription>Selecione a loja e a data para salvar este resultado no seu feed comparativo.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="storeName-step" className="text-sm font-medium mb-2 block">Nome da Loja (Obrigatório)</Label>
                                    <Select onValueChange={setStoreName} value={storeName}>
                                        <SelectTrigger id="storeName-step">
                                            <SelectValue placeholder="Selecione uma loja" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableStoresForDate.length > 0 ? (
                                                availableStoresForDate.map(store => (
                                                    <SelectItem key={store} value={store}>{store}</SelectItem>
                                                ))
                                            ) : (
                                                <SelectItem value="" disabled>Nenhuma loja disponível para esta data</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="listDate-step" className="text-sm font-medium mb-2 block">Data da Lista</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !date && "text-muted-foreground"
                                            )}
                                            disabled={!date}
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
                            <Button onClick={sendToFeed} disabled={!storeName || !step3Result}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Enviar para o Feed
                            </Button>
                        </CardContent>
                    </Card>

                    <ProductTable products={step3Result.details} unprocessedItems={step2Result?.unprocessedItems} />
                </>
            )}
        </main>
    );
}
