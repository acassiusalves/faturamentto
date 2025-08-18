
'use client';

import { useActionState, useState, useEffect, useTransition, useRef, FormEvent } from 'react';
import { Bot, Database, Loader2, Wand2, CheckCircle, CircleDashed, Calendar as CalendarIcon, ClipboardCopy, Send, ArrowRight, Store, RotateCcw, Check, Pencil, Save } from 'lucide-react';

import {
  organizeListAction,
  standardizeListAction,
  lookupProductsAction,
  savePromptAction, // Import the new action
  type ProductDetail,
  type OrganizeResult,
  type StandardizeListOutput,
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';


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

const DEFAULT_ORGANIZE_PROMPT = `Você é um assistente de organização de dados especialista em listas de produtos de fornecedores. Sua tarefa é pegar uma lista de produtos em texto bruto, não estruturado e com múltiplas variações, e organizá-la de forma limpa e individualizada.

**LISTA BRUTA DO FORNECEDOR:**
\`\`\`
{{{productList}}}
\`\`\`

**REGRAS DE ORGANIZAÇÃO:**
1.  **Um Produto Por Linha:** A regra principal é identificar cada produto e suas variações. Se um item como "iPhone 13" tem duas cores (Azul e Preto) listadas, ele deve ser transformado em duas linhas separadas na saída.
2.  **Agrupamento por Variação:** Fique atento a padrões onde um item principal tem várias cores ou preços listados juntos. Crie uma linha separada para cada combinação de produto/variação.
3.  **Extração de Detalhes:** Para cada linha, extraia os detalhes que conseguir identificar: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor e Preço.
4.  **Limpeza Geral:** Remova qualquer informação desnecessária: saudações ("Bom dia"), emojis, formatação excessiva (ex: "---"), ou palavras de marketing que não são essenciais ("Qualidade Premium", "Oportunidade").
5.  **Formato de Quantidade:** Padronize a quantidade para o formato "1x " no início de cada linha. Se nenhuma quantidade for mencionada, assuma 1.

**EXEMPLO DE ENTRADA:**
\`\`\`
Bom dia! Segue a lista:
- 2x IPHONE 15 PRO MAX 256GB - AZUL/PRETO - 5.100,00
- SAMSUNG GALAXY S24 ULTRA 512GB, 12GB RAM, cor Creme - 5.100,00
- 1x POCO X6 5G 128GB/6GB RAM
\`\`\`

**EXEMPLO DE SAÍDA ESPERADA:**
\`\`\`json
{
    "organizedList": [
        "2x IPHONE 15 PRO MAX 256GB - AZUL - 5.100,00",
        "2x IPHONE 15 PRO MAX 256GB - PRETO - 5.100,00",
        "1x SAMSUNG GALAXY S24 ULTRA 512GB, 12GB RAM, cor Creme - 5.100,00",
        "1x POCO X6 5G 128GB/6GB RAM"
    ]
}
\`\`\`

Apenas retorne o JSON com a chave 'organizedList' contendo um array de strings, onde cada string é uma variação de produto em sua própria linha.
`;

const DEFAULT_STANDARDIZE_PROMPT = `Você é um especialista em padronização de dados de produtos. Sua tarefa é analisar a lista de produtos já organizada e reescrevê-la em um formato padronizado e estruturado.

    **LISTA ORGANIZADA PARA ANÁLISE:**
    \`\`\`
    {{{organizedList}}}
    \`\`\`

    **REGRAS DE PADRONIZAÇÃO:**
    1.  **Extração de Componentes:** Para cada linha, identifique e extraia os seguintes dados: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor, Rede (4G/5G, se houver) e Preço. **Importante:** Não adivinhe a marca; use apenas o que está escrito no item.
    2.  **Ordem Estrita:** Reorganize os componentes extraídos para seguir EXATAMENTE esta ordem, separados por um espaço: \`Marca Modelo Armazenamento Global Memoria Cor Rede Preço\`.
    3.  **Formatação de Memória:** Garanta que "GB" ou "TB" esteja associado ao armazenamento e que a memória RAM seja identificada corretamente (ex: "8GB RAM"). Formatos como "8/256GB" significam "8GB RAM" e "256GB" de armazenamento.
    4.  **Omissão de Rede:** Se a conectividade (4G ou 5G) não for mencionada na linha original do produto, essa informação deve ser **omitida** da string final. Não assuma um valor padrão.
    5.  **Manutenção do Preço:** O preço DEVE ser mantido no final de cada linha padronizada.
    6.  **Limpeza de Dados:** Após a padronização, remova qualquer informação extra que não se encaixe na nova estrutura (por exemplo, "6/128GB", "Versão Global", "Americano A+") para limpar a descrição do produto.
    7.  **Tratamento de Erros:** Se uma linha não puder ser padronizada (por faltar informações essenciais como preço, ou se o formato for muito confuso), adicione-a à lista 'unprocessedItems' com uma breve justificativa (ex: "Faltando preço", "Formato de memória/armazenamento irreconhecível").

    **EXEMPLO DE ENTRADA:**
    \`\`\`
    1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00
    1x REDMI NOTE 14 PRO 5G 8/256GB - PRETO - 1.235,00
    1x Produto com defeito sem preço
    \`\`\`

    **EXEMPLO DE SAÍDA ESPERADA:**
    \`\`\`json
    {
        "standardizedList": [
            "iPhone 13 128GB Global 4GB RAM Rosa 2.000,00",
            "Redmi Note 14 Pro 256GB Global 8GB RAM Preto 5G 1.235,00"
        ],
        "unprocessedItems": [
        {
            "line": "1x Produto com defeito sem preço",
            "reason": "Faltando preço"
        }
        ]
    }
    \`\`\`

    Execute a análise e gere a lista padronizada e a lista de itens não processados. A saída deve ser um JSON válido.
    `;

const DEFAULT_LOOKUP_PROMPT = `Você é um sistema avançado de busca e organização para um e-commerce de celulares. Sua tarefa é cruzar a 'Lista Padronizada' com o 'Banco de Dados', aplicar regras de negócio específicas e organizar o resultado.

        **LISTA PADRONIZADA (Resultado do Passo 2):**
        \`\`\`
        {{{productList}}}
        \`\`\`

        **BANCO DE DADOS (Nome do Produto\tSKU):**
        \`\`\`
        {{{databaseList}}}
        \`\`\`

        **REGRAS DE PROCESSAMENTO E BUSCA:**
        1.  **Correspondência Inteligente:** Para cada item na 'Lista Padronizada', encontre a correspondência mais próxima no 'Banco de Dados'.
        2.  **Foco nos Componentes-Chave:** Para a correspondência, priorize os seguintes componentes: **Modelo, RAM e Armazenamento**. Variações pequenas no nome (como "/") podem ser ignoradas se estes componentes forem idênticos.
        3.  **Regra de Conectividade Padrão:**
            *   Se a 'Lista Padronizada' não especificar "4G" ou "5G", assuma **4G** como padrão ao procurar no 'Banco de Dados'.
            *   Se houver dois produtos idênticos no 'Banco de Dados' (um 4G e outro 5G), e a lista de entrada não especificar, priorize a versão **4G**. A versão 5G só deve ser escolhida se "5G" estiver explicitamente na linha do produto de entrada.
        4.  **Extração de Preço:** O preço de custo (\`costPrice\`) deve ser o valor numérico extraído do final de cada linha da 'Lista Padronizada'. Remova qualquer formatação de milhar (pontos) e use um ponto como separador decimal (ex: "1.234,56" deve se tornar "1234.56").
        5.  **Formato de Saída (JSON):** A saída deve ser um array de objetos JSON dentro da chave 'details'. Cada objeto deve conter:
            *   \`sku\`: O código do produto do 'Banco de Dados'. Se não houver uma correspondência com alta confiança, use a string **"SEM CÓDIGO"**.
            *   \`name\`: O nome completo e oficial do produto, **exatamente como está no 'Banco de Dados'**. Se não for encontrado, repita o nome original da 'Lista Padronizada'.
            *   \`costPrice\`: O preço de custo extraído e formatado como número.

        **REGRAS DE ORGANIZAÇÃO DO RESULTADO FINAL:**
        1.  **Agrupamento por Marca:** Organize o array 'details' final agrupando os produtos por marca na seguinte ordem de prioridade: **Xiaomi, Realme, Motorola, Samsung**.
        2.  **Ignorar Outras Marcas:** Produtos de marcas que não sejam uma das quatro mencionadas acima devem ser completamente ignorados e não devem aparecer no resultado final.
        3.  **Itens "SEM CÓDIGO":** Todos os produtos para os quais não foi encontrado um SKU (ou seja, \`sku\` é "SEM CÓDIGO") devem ser movidos para o **final da lista**, após todas as marcas.

        **EXEMPLO DE SAÍDA ESPERADA:**
        \`\`\`json
        {
          "details": [
            { "sku": "#XMS12P256A", "name": "Xiaomi Mi 12S 256GB 8GB RAM 5G - Versão Global", "costPrice": "3100.00" },
            { "sku": "#RMGTN256P", "name": "Realme GT Neo 256GB 12GB RAM 5G - Preto", "costPrice": "2800.00" },
            { "sku": "#MTG2264A", "name": "Motorola Moto G22 64GB 4GB RAM 4G - Azul", "costPrice": "980.00" },
            { "sku": "#SMA53128V", "name": "Samsung Galaxy A53 128GB 8GB RAM 5G - Verde", "costPrice": "1500.00" },
            { "sku": "SEM CÓDIGO", "name": "Tablet Desconhecido 64GB 4GB RAM 4G", "costPrice": "630.00" }
          ]
        }
        \`\`\`

        Execute a busca, aplique todas as regras de negócio e de organização, e gere o JSON final completo.
        `;

function FullPipelineTab() {
  const { toast } = useToast();
  // This tab is not fully implemented with a single pipeline action anymore.
  // It could be re-enabled by creating a new `processListPipelineAction` that orchestrates the three steps.
  // For now, it's a placeholder.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo Completo (Em Breve)</CardTitle>
        <CardDescription>
          Esta funcionalidade para processar a lista inteira com um único clique será ativada em breve. Por favor, utilize a aba "Passo a Passo" por enquanto.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function StepByStepTab() {
    const { toast } = useToast();
    const [databaseList, setDatabaseList] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [modelName, setModelName] = useState('');
    const [isOrganizing, startOrganizeTransition] = useTransition();
    const [isStandardizing, startStandardizeTransition] = useTransition();
    const [isLookingUp, startLookupTransition] = useTransition();
    const [progress, setProgress] = useState(0);

    // Form inputs
    const [initialProductList, setInitialProductList] = useState('');
    const [storeName, setStoreName] = useState('');
    const [availableStores, setAvailableStores] = useState<string[]>([]);
    const [date, setDate] = useState<Date | undefined>();

    // States for each step's result
    const [step1Result, setStep1Result] = useState<OrganizeResult | null>(null);
    const [step2Result, setStep2Result] = useState<StandardizeListOutput | null>(null);
    const [step3Result, setStep3Result] = useState<LookupResult | null>(null);
    
    // States for prompt overrides
    const [organizePrompt, setOrganizePrompt] = useState(DEFAULT_ORGANIZE_PROMPT);
    const [standardizePrompt, setStandardizePrompt] = useState(DEFAULT_STANDARDIZE_PROMPT);
    const [lookupPrompt, setLookupPrompt] = useState(DEFAULT_LOOKUP_PROMPT);

    // State for saving prompts
    const [savePromptState, handleSavePrompt] = useActionState(savePromptAction, { error: null });
    const [isSavingPrompt, startSavingPromptTransition] = useTransition();

    
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
              if (appSettings) {
                setAvailableStores(appSettings.stores || []);
                if(appSettings.organizePrompt) setOrganizePrompt(appSettings.organizePrompt);
                if(appSettings.standardizePrompt) setStandardizePrompt(appSettings.standardizePrompt);
                if(appSettings.lookupPrompt) setLookupPrompt(appSettings.lookupPrompt);
              }
            } catch (error) {
              console.error("Failed to load data", error);
            }
        }
        loadData();
    }, []);

    const isProcessing = isOrganizing || isStandardizing || isLookingUp;

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isProcessing) {
            setProgress(0);
            timer = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(timer);
                        return prev;
                    }
                    return prev + 5;
                });
            }, 200);
        } else {
            setProgress(100);
            setTimeout(() => setProgress(0), 500); // Reset after completion animation
        }
        return () => clearInterval(timer);
    }, [isProcessing]);
    
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
        // Do not reset prompts on restart, they are now loaded from settings
        toast({
            title: "Processo Reiniciado",
            description: "Você pode começar uma nova análise."
        })
    }

    const handleOrganize = () => {
        startOrganizeTransition(async () => {
            const formData = new FormData();
            formData.append('productList', initialProductList);
            formData.append('apiKey', apiKey);
            formData.append('modelName', modelName);
            formData.append('prompt_override', organizePrompt);
            
            const result = await organizeListAction({ result: null, error: null }, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao Organizar', description: result.error });
            }
            setStep1Result(result.result);
            setStep2Result(null);
            setStep3Result(null);
        });
    };

    const handleStandardize = () => {
        if (!step1Result?.organizedList) return;
        startStandardizeTransition(async () => {
            const formData = new FormData();
            formData.append('organizedList', step1Result.organizedList.join('\n'));
            formData.append('apiKey', apiKey);
            formData.append('modelName', modelName);
            formData.append('prompt_override', standardizePrompt);
            
            const result = await standardizeListAction({ result: null, error: null }, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao Padronizar', description: result.error });
            }
            setStep2Result(result.result);
            setStep3Result(null);
        });
    };

    const handleLookup = () => {
        if (!step2Result?.standardizedList) return;
        startLookupTransition(async () => {
            const formData = new FormData();
            formData.append('productList', step2Result.standardizedList.join('\n'));
            formData.append('databaseList', databaseList);
            formData.append('apiKey', apiKey);
            formData.append('modelName', modelName);
            formData.append('prompt_override', lookupPrompt);
            
            const result = await lookupProductsAction({ result: null, error: null }, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao Buscar', description: result.error });
            }
            setStep3Result(result.result);
        });
    };

    const sendToFeed = () => {
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

      const getStepIcon = (isProcessing: boolean, result: any) => {
        if (isProcessing) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
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
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button variant="ghost" onClick={handleRestart}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Recomeçar
                </Button>
            </div>
            {/* Step 1: Organize */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        {getStepIcon(isOrganizing, step1Result)}
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
                            disabled={isOrganizing || !!step1Result}
                        />
                        <Button onClick={handleOrganize} disabled={isOrganizing || !initialProductList || !!step1Result}>
                            {isOrganizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Organizar
                        </Button>
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
                        {isOrganizing && progress > 0 && (
                            <div className="flex items-center gap-4 pt-2">
                                <Progress value={progress} className="w-full" />
                                <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {step1Result && (
                <div className="flex flex-col items-center">
                    <ArrowRight className="h-8 w-8 text-muted-foreground my-4" />
                    {/* Step 2: Standardize */}
                    <Card className="w-full">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    {getStepIcon(isStandardizing, step2Result)}
                                    <div>
                                        <CardTitle className="font-headline text-xl">Passo 2: Padronizar Lista</CardTitle>
                                        <CardDescription>A lista organizada abaixo será usada para padronização.</CardDescription>
                                    </div>
                                </div>
                                {step1Result && (
                                    <Badge variant="secondary" className="text-base font-semibold">{step1Result.organizedList.length} Produtos</Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Textarea
                                    readOnly
                                    value={step1Result.organizedList.join('\n') || ''}
                                    className="min-h-[150px] bg-white/50 text-xs"
                                />
                                <Button onClick={handleStandardize} disabled={isStandardizing || step1Result.organizedList.length === 0 || !!step2Result}>
                                    {isStandardizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                                    Padronizar
                                </Button>
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
                                {isStandardizing && progress > 0 && (
                                    <div className="flex items-center gap-4 pt-2">
                                        <Progress value={progress} className="w-full" />
                                        <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            {step2Result?.unprocessedItems && step2Result.unprocessedItems.length > 0 && (
                <UnprocessedItemsTable items={step2Result.unprocessedItems} />
            )}

            {step2Result?.standardizedList && (
                 <div className="flex flex-col items-center">
                    <ArrowRight className="h-8 w-8 text-muted-foreground my-4" />
                    {/* Step 3: Lookup */}
                    <Card className="w-full">
                        <CardHeader>
                             <div className="flex items-center gap-4">
                                {getStepIcon(isLookingUp, step3Result)}
                                <div>
                                    <CardTitle className="font-headline text-xl">Passo 3: Buscar no Banco de Dados</CardTitle>
                                    <CardDescription>A lista padronizada abaixo será cruzada com seu banco de dados.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Textarea
                                    readOnly
                                    value={step2Result.standardizedList.join('\n') || ''}
                                    className="min-h-[150px] bg-white/50 text-xs"
                                />
                                <Button onClick={handleLookup} disabled={isLookingUp || step2Result.standardizedList.length === 0 || !databaseList || !!step3Result}>
                                    {isLookingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                                    Buscar Produtos
                                </Button>
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
                                {isLookingUp && progress > 0 && (
                                    <div className="flex items-center gap-4 pt-2">
                                        <Progress value={progress} className="w-full" />
                                        <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
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
                                            {availableStores.length > 0 ? availableStores.map(store => (
                                                <SelectItem key={store} value={store}>{store}</SelectItem>
                                            )) : (
                                                <div className="p-2 text-sm text-muted-foreground">Nenhuma loja cadastrada.</div>
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
                                <Send className="mr-2 h-4 w-4" />
                                Enviar para o Feed
                            </Button>
                        </CardContent>
                    </Card>

                    <ProductTable products={step3Result.details} unprocessedItems={step2Result?.unprocessedItems} />
                </>
            )}
        </div>
    )
}


export default function ListaPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        <Tabs defaultValue="step-by-step">
            <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                <TabsTrigger value="pipeline">Fluxo Completo</TabsTrigger>
                <TabsTrigger value="step-by-step">Passo a Passo</TabsTrigger>
            </TabsList>
            <TabsContent value="pipeline" className="mt-6">
                <FullPipelineTab />
            </TabsContent>
            <TabsContent value="step-by-step" className="mt-6">
                <StepByStepTab />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
