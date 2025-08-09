"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MappingForm } from "@/components/mapping-form";
import { FriendlyMappingForm } from "@/components/friendly-mapping-form";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, CheckCircle, XCircle, AlertTriangle, Upload, Sparkles, Plug, FileDown, Sheet, Database, Info, FileSpreadsheet, HardDriveUpload, ArrowRight, Map, Save, Pencil } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ColumnMapping, AllMappingsState, Sale, ApiKeyStatus } from "@/lib/types";
import Papa from 'papaparse';
import { getMappingSuggestions } from "@/lib/actions";
import { testIderisConnection } from "@/services/ideris";
import { removeAccents } from "@/lib/utils";
import { SuggestionDialog } from "@/components/suggestion-dialog";
import { systemFields } from "@/lib/system-fields";
import { iderisFields } from "@/lib/ideris-fields";
import { saveAppSettings, loadAppSettings, saveSales, loadSales } from "@/services/firestore";
import { fetchOrdersFromIderis } from "@/services/ideris";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { startOfMonth, endOfMonth } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const marketplaces = [
  { id: "magalu", name: "Magalu", logo: "https://placehold.co/100x40.png", dataAiHint: "brand logo" },
  { id: "mercado-livre", name: "Mercado Livre", logo: "https://placehold.co/100x40.png", dataAiHint: "brand logo" },
];


const ApiStatusBadge = ({ status }: { status: ApiKeyStatus }) => {
    switch (status) {
        case 'valid':
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-4 w-4" /> Válida</Badge>;
        case 'invalid':
            return <Badge variant="destructive"><XCircle className="mr-1 h-4 w-4" /> Inválida</Badge>;
        default:
            return <Badge variant="secondary"><AlertTriangle className="mr-1 h-4 w-4" /> Não verificada</Badge>;
    }
};

export default function MappingPage() {
  const [headers, setHeaders] = useState<{ [key: string]: string[] }>({});
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState({ current: 0, total: 0 });
  const [iderisPrivateKey, setIderisPrivateKey] = useState("");
  const [googleSheetsApiKey, setGoogleSheetsApiKey] = useState("");
  const [googleSheetId, setGoogleSheetId] = useState("");
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetFriendlyNames, setSheetFriendlyNames] = useState<Record<string, string>>({});
  const [isMappingSheet, setIsMappingSheet] = useState(false);
  const [isImportingSheet, setIsImportingSheet] = useState(false);
  const [sheetAssociationKey, setSheetAssociationKey] = useState<string>("");
  const [iderisApiStatus, setIderisApiStatus] = useState<ApiKeyStatus>('unchecked');
  const [googleSheetsApiStatus, setGoogleSheetsApiStatus] = useState<ApiKeyStatus>('unchecked');
  const [allMappings, setAllMappings] = useState<AllMappingsState>({});
  const [friendlyNames, setFriendlyNames] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<{ [key: string]: string }>({});
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeMarketplaceForSuggestion, setActiveMarketplaceForSuggestion] = useState("");
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [importedSalesCount, setImportedSalesCount] = useState(0);


  const { toast } = useToast();
  
  useEffect(() => {
    async function loadData() {
        setIsDataLoading(true);
        const [settings, sales] = await Promise.all([
            loadAppSettings(),
            loadSales()
        ]);
        
        if (settings) {
            setIderisPrivateKey(settings.iderisPrivateKey || "");
            setGoogleSheetsApiKey(settings.googleSheetsApiKey || "");
            setAllMappings(settings.allMappings || {});
            setFriendlyNames(settings.friendlyFieldNames || {});
            setFileNames(settings.fileNames || {});
            if (settings.iderisApiStatus) {
                setIderisApiStatus(settings.iderisApiStatus as ApiKeyStatus);
            }
             if (settings.googleSheetsApiStatus) {
                setGoogleSheetsApiStatus(settings.googleSheetsApiStatus as ApiKeyStatus);
            }
             // Load headers from saved file data if available
            const initialHeaders: { [key: string]: string[] } = {};
            for (const mp of marketplaces) {
                const fileData = settings.fileData?.[mp.id];
                if (fileData) {
                    Papa.parse(fileData, {
                        encoding: "UTF-8",
                        preview: 1,
                        complete: (results) => {
                            if (results.data && Array.isArray(results.data[0])) {
                                initialHeaders[mp.id] = (results.data[0] as string[]).map(h => removeAccents(h.trim()));
                            }
                        }
                    });
                }
            }
            setHeaders(initialHeaders);
        }
        setImportedSalesCount(sales.length);
        setIsDataLoading(false);
    }
    loadData();
  }, []);

  const handleMappingsChange = async (marketplaceId: string, newMappings: Partial<ColumnMapping>) => {
    const updatedAllMappings = { ...allMappings, [marketplaceId]: newMappings };
    setAllMappings(updatedAllMappings);
    // Directly save to mock service
    await saveAppSettings({ allMappings: updatedAllMappings });
  };
  
  const handleFriendlyNamesChange = async (newFriendlyNames: Record<string, string>) => {
    setFriendlyNames(newFriendlyNames);
    await saveAppSettings({ friendlyFieldNames: newFriendlyNames });
     toast({
      title: "Nomes Amigáveis Salvos",
      description: "Os nomes das colunas foram atualizados.",
    });
  }

  const handleSuggestionSave = (marketplaceId: string, acceptedSuggestions: Record<string, string>) => {
    const newMappingsForMarketplace = { ...(allMappings[marketplaceId] || {}), ...acceptedSuggestions };
    handleMappingsChange(marketplaceId, newMappingsForMarketplace);
    setIsSuggestionOpen(false);
  };

  const handleFileUpload = useCallback(async (file: File, marketplaceId: string) => {
    setIsLoading(prev => ({ ...prev, [marketplaceId]: true }));
    if (!file) {
      toast({ variant: 'destructive', title: 'Nenhum arquivo selecionado.' });
      setIsLoading(prev => ({ ...prev, [marketplaceId]: false }));
      return;
    }

    const updatedFileNames = { ...fileNames, [marketplaceId]: file.name };
    setFileNames(updatedFileNames);
    
    const fileContent = await file.text();
    
    const currentSettings = await loadAppSettings();
    const settingsToSave = {
        fileNames: updatedFileNames,
        fileData: { ...(currentSettings?.fileData || {}), [marketplaceId]: fileContent },
    };
    await saveAppSettings(settingsToSave);

    Papa.parse(fileContent, {
        encoding: "UTF-8",
        preview: 1,
        complete: (results) => {
          if (results.data && Array.isArray(results.data[0])) {
            const fileHeaders = (results.data[0] as string[]).map(h => removeAccents(h.trim()));
            setHeaders(prev => ({ ...prev, [marketplaceId]: fileHeaders }));
            toast({
              title: "Arquivo Carregado",
              description: `Cabeçalhos do arquivo ${file.name} foram lidos e salvos.`,
            });
          } else {
            toast({ variant: 'destructive', title: 'Erro ao ler o arquivo', description: 'Não foi possível extrair os cabeçalhos do arquivo CSV.' });
          }
          setIsLoading(prev => ({ ...prev, [marketplaceId]: false }));
        },
        error: (error) => {
          toast({ variant: 'destructive', title: 'Erro de parse', description: error.message });
          setIsLoading(prev => ({ ...prev, [marketplaceId]: false }));
        }
    });
  }, [toast, fileNames]);
  
  const handleIderisImport = async () => {

    if (iderisApiStatus !== 'valid' || !iderisPrivateKey) {
        toast({ variant: "destructive", title: "Conexão Inválida", description: "Por favor, valide sua conexão com a Ideris antes de importar." });
        return;
    }

    let finalDateRange = dateRange;
    if (!finalDateRange?.from || !finalDateRange?.to) {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        finalDateRange = { from, to };
        toast({ title: "Período não selecionado", description: "Buscando os pedidos dos últimos 30 dias." });
    }
    
    setImportProgress(0);
    setImportStatus({ current: 0, total: 0 });
    setIsImporting(true);

    const progressCallback = (progress: number, current: number, total: number) => {
        setImportProgress(progress);
        setImportStatus({ current, total });
    };

    try {
        const existingSales = await loadSales();
        const existingSaleIds = existingSales.map(s => s.id);
        const data = await fetchOrdersFromIderis(iderisPrivateKey, finalDateRange, existingSaleIds, progressCallback);
        
        if (data.length === 0) {
            toast({ title: "Nenhuma Venda Nova Encontrada", description: "Não foram encontradas novas vendas no período selecionado ou todas já foram importadas." });
        } else {
            await saveSales(data);
            const currentSales = await loadSales();
            setImportedSalesCount(currentSales.length);
            toast({
              title: "Importação Concluída!",
              description: `${data.length} novas vendas foram importadas da API da Ideris.`,
            });
        }
    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
        toast({ variant: "destructive", title: "Erro na Importação", description: errorMessage });
    } finally {
        setIsImporting(false);
        setImportProgress(0);
    }
  };

  const handleRemoveFile = useCallback(async (marketplaceId: string) => {
    
    const updatedFileNames = { ...fileNames };
    delete updatedFileNames[marketplaceId];
    setFileNames(updatedFileNames);

    const updatedMappings = { ...allMappings };
    delete updatedMappings[marketplaceId];
    setAllMappings(updatedMappings);

    const currentSettings = await loadAppSettings();
    const updatedFileData = { ...currentSettings?.fileData };
    if (updatedFileData) {
        delete updatedFileData[marketplaceId];
    }

    await saveAppSettings({ fileNames: updatedFileNames, allMappings: updatedMappings, fileData: updatedFileData });

    setHeaders(prev => {
        const newState = {...prev};
        delete newState[marketplaceId];
        return newState;
    });
    toast({ title: "Arquivo Removido", description: `O arquivo para ${marketplaceId} foi removido com sucesso.` });
  }, [toast, fileNames, allMappings]);

  const handleIderisTokenChange = (value: string) => {
    setIderisPrivateKey(value);
    setIderisApiStatus("unchecked");
  }

  const handleSaveIderisCredentials = async () => {
    if (!iderisPrivateKey) {
        toast({ variant: "destructive", title: "A Chave Privada Ideris é obrigatória."});
        return;
    }
    
    setIsTestingConnection(true);
    try {
        await saveAppSettings({ iderisPrivateKey });
        const result = await testIderisConnection(iderisPrivateKey);
        
        if (result.success) {
            setIderisApiStatus('valid');
            await saveAppSettings({ iderisApiStatus: 'valid' });
            toast({ title: "Sucesso!", description: "A conexão com a API da Ideris foi bem-sucedida e as credenciais foram salvas." });
        } else {
            setIderisApiStatus('invalid');
            await saveAppSettings({ iderisApiStatus: 'invalid' });
            toast({ variant: "destructive", title: "Falha na Conexão", description: result.message });
        }
    } catch (e: any) {
        setIderisApiStatus('invalid');
        await saveAppSettings({ iderisApiStatus: 'invalid' });
        toast({ variant: "destructive", title: "Erro Inesperado", description: e.message || "Não foi possível verificar a conexão." });
    } finally {
        setIsTestingConnection(false);
    }
  }
  
    const handleMapSheet = async () => {
        if (!googleSheetId) {
            toast({ variant: "destructive", title: "ID da Planilha Inválido", description: "Por favor, insira o ID da planilha." });
            return;
        }
        if (!googleSheetsApiKey) {
            toast({ variant: "destructive", title: "Chave de API Necessária", description: "Por favor, insira sua chave de API do Google." });
            return;
        }

        setIsMappingSheet(true);
        try {
            // const fetchedHeaders = await getSheetHeaders(googleSheetId, googleSheetsApiKey);
            const fetchedHeaders: string[] = [];
            
            if (fetchedHeaders.length === 0) {
                setGoogleSheetsApiStatus('invalid');
                await saveAppSettings({ googleSheetsApiStatus: 'invalid' });
                toast({ variant: "destructive", title: "Nenhum Cabeçalho Encontrado", description: "A planilha está vazia ou a primeira linha não contém dados. Verifique o ID e se a planilha está pública." });
                setSheetHeaders([]);
            } else {
                setGoogleSheetsApiStatus('valid');
                await saveAppSettings({ googleSheetsApiStatus: 'valid' });
                setSheetHeaders(fetchedHeaders);
                const orderNumberCandidate = fetchedHeaders.find(h => removeAccents(h.toLowerCase()).includes('pedido'));
                if (orderNumberCandidate) {
                    setSheetAssociationKey(orderNumberCandidate);
                }
                toast({ title: "Planilha Lida e Conexão Válida!", description: "As colunas foram extraídas. Defina os nomes amigáveis." });
            }
        } catch (error) {
            setGoogleSheetsApiStatus('invalid');
            await saveAppSettings({ googleSheetsApiStatus: 'invalid' });
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            toast({ variant: "destructive", title: "Erro ao Mapear", description: errorMessage });
            setSheetHeaders([]);
        } finally {
            setIsMappingSheet(false);
        }
    };
    
    const handleSaveApiKey = async () => {
        if (!googleSheetsApiKey) return;
        setIsMappingSheet(true);
        try {
            await saveAppSettings({ googleSheetsApiKey });
            toast({ title: "Chave de API Salva!", description: "Agora você pode inserir o ID da planilha para mapear." });
        } catch(e) {
             toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a chave de API."});
        } finally {
            setIsMappingSheet(false);
        }
    }

    const handleSheetFriendlyNameChange = (header: string, name: string) => {
        setSheetFriendlyNames(prev => ({ ...prev, [header]: name }));
    };

    const handleRemoveSheetHeader = (headerToRemove: string) => {
        setSheetHeaders(prev => prev.filter(h => h !== headerToRemove));
        setSheetFriendlyNames(prev => {
            const newNames = { ...prev };
            delete newNames[headerToRemove];
            return newNames;
        });
        if (sheetAssociationKey === headerToRemove) {
            setSheetAssociationKey("");
        }
    };

    const handleSaveAndImportSheet = async () => {
        setIsImportingSheet(true);
        try {
            // const result = await importFromSheet(googleSheetId, googleSheetsApiKey, sheetFriendlyNames, sheetAssociationKey);
            const result = {success: false, message: 'Not implemented'};
            if (result.success) {
                toast({
                    title: "Importação Concluída!",
                    // description: `${result.updatedCount} vendas foram atualizadas com os dados da planilha.`,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            toast({ variant: "destructive", title: "Erro na Importação", description: errorMessage });
        } finally {
            setIsImportingSheet(false);
        }
    };

    const handleChangeApiKey = async () => {
        setGoogleSheetsApiKey("");
        setGoogleSheetsApiStatus("unchecked");
        setSheetHeaders([]); // Clear mapped headers as the key is being changed
        await saveAppSettings({ googleSheetsApiKey: "", googleSheetsApiStatus: "unchecked" });
        toast({ title: "Chave de API Removida", description: "Por favor, insira e valide a nova chave." });
    }

  const handleOpenSuggestDialog = (marketplaceId: string) => {
    const marketplaceHeaders = marketplaceId === 'ideris' ? iderisFields.map(f => f.key) : headers[marketplaceId];
    if (!marketplaceHeaders || marketplaceHeaders.length === 0) {
      toast({
        variant: "destructive",
        title: "Cabeçalhos não encontrados",
        description: marketplaceId === 'ideris' 
          ? "Não foi possível carregar os campos da Ideris."
          : "Carregue um arquivo CSV antes de usar a sugestão da IA.",
      });
      return;
    }
    setActiveMarketplaceForSuggestion(marketplaceId);
    setIsSuggestionOpen(true);
  };

  if (isDataLoading) {
    return (
       <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Mapeamento e Conexões</h1>
          <p className="text-muted-foreground">
            Conecte suas fontes de dados. A Ideris é a base, e você pode complementar com planilhas.
          </p>
        </div>
        
        <Tabs defaultValue="ideris-api" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ideris-api"><Database />Ideris API (Base)</TabsTrigger>
            <TabsTrigger value="google-sheets"><FileSpreadsheet/>Google Planilhas</TabsTrigger>
            <TabsTrigger value="local-file"><HardDriveUpload/>Arquivo Local (CSV)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ideris-api" className="space-y-8 pt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Fonte Principal: Ideris API</CardTitle>
                        <CardDescription>
                        A Ideris é a base para a importação de pedidos. Conecte sua conta para começar.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted p-2 rounded-md">
                        <Database className="h-4 w-4" />
                        <span>{importedSalesCount} Pedidos já importados</span>
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6 items-start">
                      <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="ideris-private-key">Chave Privada Ideris (`login_token`)</Label>
                                <ApiStatusBadge status={iderisApiStatus} />
                            </div>
                            <Input
                                id="ideris-private-key"
                                value={iderisPrivateKey}
                                onChange={(e) => handleIderisTokenChange(e.target.value)}
                                placeholder="Cole aqui sua chave privada da Ideris"
                                type="password"
                            />
                        </div>
                        <Button onClick={handleSaveIderisCredentials} disabled={isTestingConnection || !iderisPrivateKey}>
                            {isTestingConnection ? <Loader2 className="animate-spin" /> : <Plug />}
                            Salvar e Testar Conexão
                        </Button>
                    </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Período de Importação</Label>
                            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2">
                                <Button onClick={handleIderisImport} disabled={isImporting || iderisApiStatus !== 'valid'} className="flex-1">
                                    {isImporting ? <Loader2 className="animate-spin" /> : <Sheet />}
                                    {isImporting ? "Importando..." : "Importar/Atualizar Vendas"}
                                </Button>
                                <Button variant="outline" disabled className="flex-1">
                                    <FileDown />
                                    Exportar Dados
                                </Button>
                            </div>
                            {isImporting && (
                              <div className="space-y-2">
                                <Progress value={importProgress} />
                                <p className="text-sm text-muted-foreground text-center">
                                  {importStatus.total > 0
                                    ? `Importando ${importStatus.current} de ${importStatus.total} pedidos...`
                                    : 'Buscando pedidos...'}
                                </p>
                                <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-800">
                                  <Info className="h-4 w-4 !text-yellow-700" />
                                  <AlertTitle className="font-semibold">Importação em Andamento</AlertTitle>
                                  <AlertDescription>
                                    Por favor, não saia desta página. O processo pode levar alguns minutos.
                                  </AlertDescription>
                                </Alert>
                              </div>
                            )}
                        </div>
                    </div>
                </div>
              </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Mapeamento Amigável (Ideris)</CardTitle>
                    <CardDescription>
                        Você pode definir um nome amigável para cada campo da Ideris para facilitar a visualização no sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FriendlyMappingForm
                        initialNames={friendlyNames}
                        onSave={handleFriendlyNamesChange}
                    />
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="google-sheets" className="space-y-8 pt-6">
             <Card>
                <CardHeader>
                    <CardTitle>Conectar com Google Planilhas</CardTitle>
                    <CardDescription>Forneça sua Chave de API e o ID da planilha pública para ler os dados complementares.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="google-sheets-api-key">Chave de API do Google</Label>
                                    <ApiStatusBadge status={googleSheetsApiStatus} />
                                </div>
                                <Input
                                    id="google-sheets-api-key"
                                    value={googleSheetsApiKey}
                                    onChange={(e) => {
                                        setGoogleSheetsApiKey(e.target.value);
                                        setGoogleSheetsApiStatus("unchecked");
                                    }}
                                    placeholder="Cole aqui sua chave de API"
                                    type="password"
                                    disabled={googleSheetsApiStatus === 'valid'}
                                />
                            </div>
                             <div className="flex gap-2">
                                {googleSheetsApiStatus !== 'valid' ? (
                                    <Button onClick={handleSaveApiKey} disabled={isMappingSheet || !googleSheetsApiKey}>
                                        {isMappingSheet ? <Loader2 className="animate-spin" /> : <Save />}
                                        Salvar Chave
                                    </Button>
                                ) : (
                                    <Button onClick={handleChangeApiKey} variant="outline">
                                        <Pencil />
                                        Trocar Chave
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="google-sheet-id">ID da Planilha do Google</Label>
                                <Input
                                    id="google-sheet-id"
                                    value={googleSheetId}
                                    onChange={(e) => setGoogleSheetId(e.target.value)}
                                    placeholder="Cole o ID da sua planilha aqui"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Encontre o ID na URL: .../spreadsheets/d/<b>[ID_DA_PLANILHA]</b>/edit...
                                </p>
                            </div>
                             <Button onClick={handleMapSheet} disabled={!googleSheetId || isMappingSheet || googleSheetsApiStatus !== 'valid'}>
                                {isMappingSheet ? <Loader2 className="animate-spin" /> : <Map />}
                                Mapear Colunas da Planilha
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
              {sheetHeaders.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Mapeamento Amigável (Google Planilhas)</CardTitle>
                        <CardDescription>Defina nomes amigáveis para as colunas da sua planilha e selecione a coluna que corresponde ao "Número do Pedido" para associar os dados aos pedidos da Ideris.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-4 p-4 border rounded-lg">
                             <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-x-4 px-4 pb-2 border-b">
                                <div />
                                <h4 className="font-semibold text-sm text-muted-foreground">Coluna da Planilha</h4>
                                <div />
                                <h4 className="font-semibold text-sm text-muted-foreground">Nome Amigável</h4>
                                <h4 className="font-semibold text-sm text-muted-foreground text-center">Nº do Pedido (Chave)</h4>
                            </div>
                            <RadioGroup value={sheetAssociationKey} onValueChange={setSheetAssociationKey}>
                                {sheetHeaders.map(header => (
                                <div key={header} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-x-4 py-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveSheetHeader(header)}>
                                        <XCircle className="h-4 w-4"/>
                                    </Button>
                                    <Badge variant="secondary" className="font-normal justify-start py-2">{header}</Badge>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    <Input 
                                            placeholder={header}
                                            value={sheetFriendlyNames[header] || ""}
                                            onChange={(e) => handleSheetFriendlyNameChange(header, e.target.value)}
                                        />
                                    <div className="flex justify-center">
                                        <RadioGroupItem value={header} id={`radio-${header}`} />
                                    </div>
                                </div>
                                ))}
                            </RadioGroup>
                       </div>
                       <div className="flex justify-end mt-4">
                           <Button onClick={handleSaveAndImportSheet} disabled={!sheetAssociationKey || isImportingSheet}>
                                {isImportingSheet ? <Loader2 className="animate-spin" /> : <Save />}
                                Salvar e Importar Dados da Planilha
                           </Button>
                       </div>
                    </CardContent>
                 </Card>
              )}
          </TabsContent>
          
          <TabsContent value="local-file" className="space-y-8 pt-6">
               <Card>
                <CardHeader>
                    <CardTitle>Configurar Canais de Venda (Arquivos)</CardTitle>
                    <CardDescription>
                    Para os demais canais, configure o arquivo de origem e depois associe os campos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue={marketplaces[0]?.id} className="w-full">
                    <TabsList>
                        {marketplaces.map((mp) => (
                        <TabsTrigger key={mp.id} value={mp.id}>
                            {mp.name}
                        </TabsTrigger>
                        ))}
                    </TabsList>

                    {marketplaces.map((mp) => (
                        <TabsContent key={mp.id} value={mp.id} className="pt-6">
                            <div className="flex items-center gap-4 mb-4">
                            {mp.logo && <Image src={mp.logo} alt={`Logo ${mp.name}`} width={100} height={40} className="object-contain" data-ai-hint={mp.dataAiHint}/>}
                            </div>
                        
                            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                                <Label htmlFor={`file-upload-${mp.id}`}>Arquivo de Vendas de <span className="font-semibold">{mp.name}</span></Label>
                                <div className="flex items-center gap-4">
                                    <Button asChild variant="outline">
                                        <label htmlFor={`file-upload-${mp.id}`} className="cursor-pointer">
                                            {isLoading[mp.id] ? <Loader2 className="animate-spin" /> : <Upload className="mr-2"/>}
                                            Selecionar arquivo CSV
                                        </label>
                                    </Button>
                                    {fileNames[mp.id] && 
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{fileNames[mp.id]}</span>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(mp.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </div>
                                    }
                                </div>
                                <Input 
                                    id={`file-upload-${mp.id}`}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], mp.id)}
                                    disabled={isLoading[mp.id]}
                                />
                            </div>

                        { (headers[mp.id] && headers[mp.id].length > 0) || (allMappings[mp.id] && Object.keys(allMappings[mp.id]!).length > 0) ? (
                            <div className="mt-6">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                                <div>
                                    <h4 className="font-semibold text-lg">Mapeamento das colunas</h4>
                                    <p className="text-sm text-muted-foreground">
                                    Associe os campos do sistema com as colunas do seu arquivo.
                                    </p>
                                </div>
                                <Button onClick={() => handleOpenSuggestDialog(mp.id)} variant="outline" className="bg-accent/10 text-accent hover:bg-accent/20 border-accent/50">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Sugerir com IA
                                </Button>
                                </div>
                                <MappingForm
                                    marketplaceId={mp.id}
                                    systemFieldsToMap={systemFields}
                                    sourceFields={headers[mp.id] || []}
                                    initialMappings={allMappings[mp.id] || {}}
                                    onSave={handleMappingsChange}
                                    />
                            </div>
                        ) : null}
                        </TabsContent>
                    ))}
                    </Tabs>
                </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {isSuggestionOpen && (
          <SuggestionDialog
            isOpen={isSuggestionOpen}
            onClose={() => setIsSuggestionOpen(false)}
            marketplaceId={activeMarketplaceForSuggestion}
            headers={activeMarketplaceForSuggestion === 'ideris' ? iderisFields.map(f => f.key) : headers[activeMarketplaceForSuggestion] || []}
            onSave={handleSuggestionSave}
            isIderisApi={activeMarketplaceForSuggestion === 'ideris'}
          />
      )}
    </>
  );
}
