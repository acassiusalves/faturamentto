
"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, XCircle, Upload, ArrowRight, Save, Settings, FileSpreadsheet, PlusCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Papa from "papaparse";
import * as XLSX from "sheetjs-style";
import { removeAccents } from "@/lib/utils";
import type { SupportData, SupportFile, Sale } from "@/lib/types";
import { loadMonthlySupportData, saveMonthlySupportData, loadSalesIdsAndOrderCodes } from "@/services/firestore";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

const marketplaces = [
  { id: "magalu", name: "Magalu" },
  { id: "mercado-livre", name: "Mercado Livre" },
  { id: "frete", name: "Custo de Frete" },
  { id: "impostos", name: "Impostos" },
];

interface SupportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  monthYearKey: string;
}

export function SupportDataDialog({ isOpen, onClose, monthYearKey }: SupportDataDialogProps) {
  const [supportData, setSupportData] = useState<SupportData>({ files: {} });
  const [allSales, setAllSales] = useState<{ id: string; order_code: string; }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadInitialData() {
        if (isOpen) {
            setIsLoading(true);
            const [monthlyData, salesIds] = await Promise.all([
                loadMonthlySupportData(monthYearKey),
                loadSalesIdsAndOrderCodes()
            ]);

            if (monthlyData && monthlyData.files) {
                const sanitizedFiles: { [key: string]: SupportFile[] } = {};
                for (const channelId in monthlyData.files) {
                    const fileData = monthlyData.files[channelId];
                    if (fileData && typeof fileData === 'object' && !Array.isArray(fileData)) {
                        sanitizedFiles[channelId] = Object.values(fileData);
                    } else {
                        sanitizedFiles[channelId] = Array.isArray(fileData) ? fileData : [];
                    }
                }
                setSupportData({ files: sanitizedFiles });
            } else {
                setSupportData({ files: {} });
            }
            
            setAllSales(salesIds);
            setIsLoading(false);
        }
    }
    if (isOpen && monthYearKey) {
      loadInitialData();
    }
  }, [isOpen, monthYearKey]);

  const associationStats = useMemo(() => {
    const stats: Record<string, { associated: number, notAssociated: number }> = {};
    if (!allSales || allSales.length === 0) return stats;

    const saleKeys = new Set(allSales.map(s => String(s.order_code || '').trim()));

    for (const channelId in supportData.files) {
      for (const file of supportData.files[channelId]) {
        let associated = 0;
        let notAssociated = 0;
        if (file.fileContent && file.associationKey) {
          try {
            const parsedData = Papa.parse(file.fileContent, { header: true, skipEmptyLines: true });
            parsedData.data.forEach((row: any) => {
              const rawKey = row[file.associationKey];
               const keyToCompare = String(rawKey || '').trim();

              if (keyToCompare) {
                if (saleKeys.has(keyToCompare)) {
                  associated++;
                } else {
                  notAssociated++;
                }
              }
            });
          } catch(e) {
            console.error("Error parsing file for stats", e);
          }
        }
        stats[file.id] = { associated, notAssociated };
      }
    }
    return stats;
  }, [supportData, allSales]);


  const handleFileArrayChange = (channelId: string, newFiles: SupportFile[]) => {
      setSupportData(prev => ({
          ...prev,
          files: {
              ...prev.files,
              [channelId]: newFiles
          }
      }));
  }

  const handleFileUpload = (file: File, channelId: string, fileId: string) => {
    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processFileContent = (content: string, headers: string[]) => {
        const fileList = supportData.files[channelId] || [];
        const initialFriendlyNames: Record<string, string> = {};
        headers.forEach(h => { initialFriendlyNames[h] = ""; });

        const updatedList = fileList.map(f => {
            if (f.id === fileId) {
                return {
                    ...f,
                    fileName: file.name,
                    fileContent: content,
                    headers: headers,
                    friendlyNames: initialFriendlyNames,
                    associationKey: headers.find(h => /pedido/i.test(h)) || "",
                    uploadedAt: new Date().toISOString()
                };
            }
            return f;
        });
        handleFileArrayChange(channelId, updatedList);
        toast({ title: `Arquivo ${file.name} lido com sucesso!` });
    };

    reader.onload = (e) => {
        const result = e.target?.result;
        if (fileExtension === 'csv') {
            const content = result as string;
            Papa.parse(content, {
                preview: 1,
                skipEmptyLines: true,
                complete: (results) => {
                    if(!results.data || !Array.isArray(results.data[0])) {
                      toast({variant: 'destructive', title: 'Erro ao Ler CSV', description: 'Não foi possível encontrar cabeçalhos no arquivo.'})
                      return;
                    }
                    const headers = (results.data[0] as string[]).map((h) => removeAccents(h.trim()));
                    processFileContent(content, headers);
                },
            });
        } else if (fileExtension === 'xlsx') {
            const workbook = XLSX.read(result, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const headers = (json[0] || []).map(h => removeAccents(String(h).trim()));
            const csvContent = XLSX.utils.sheet_to_csv(worksheet);
            processFileContent(csvContent, headers);
        } else {
            toast({ variant: 'destructive', title: 'Tipo de Arquivo Inválido', description: 'Por favor, selecione um arquivo .csv ou .xlsx' });
        }
    };

    if (fileExtension === 'csv') {
        reader.readAsText(file);
    } else if (fileExtension === 'xlsx') {
        reader.readAsArrayBuffer(file);
    } else {
        toast({ variant: 'destructive', title: 'Tipo de Arquivo Inválido' });
    }
  };

  const handleAddNewFile = (channelId: string) => {
    const newFile: SupportFile = {
        id: `file-${channelId}-${Date.now()}`,
        channelId: channelId,
        fileName: "",
        fileContent: "",
        headers: [],
        friendlyNames: {},
        associationKey: "",
        uploadedAt: ""
    };
    const currentFiles = supportData.files[channelId] || [];
    handleFileArrayChange(channelId, [...currentFiles, newFile]);
  };
  
  const handleRemoveFile = (channelId: string, fileId: string) => {
      const currentFiles = supportData.files[channelId] || [];
      const updatedFiles = currentFiles.filter(f => f.id !== fileId);
      handleFileArrayChange(channelId, updatedFiles);
  }
  
  const handleMappingChange = (channelId: string, fileId: string, updatedFile: Partial<SupportFile>) => {
      const fileList = supportData.files[channelId] || [];
      const updatedList = fileList.map(f => f.id === fileId ? { ...f, ...updatedFile } : f);
      handleFileArrayChange(channelId, updatedList);
  }
  
  const handleRemoveHeader = (channelId: string, fileId: string, headerToRemove: string) => {
      const currentFile = (supportData.files[channelId] || []).find(f => f.id === fileId);
      if (!currentFile) return;

      const newHeaders = currentFile.headers?.filter(h => h !== headerToRemove);
      const newFriendlyNames = { ...currentFile.friendlyNames };
      delete newFriendlyNames[headerToRemove];
      const newAssociationKey = currentFile.associationKey === headerToRemove ? "" : currentFile.associationKey;

      handleMappingChange(channelId, fileId, {
          headers: newHeaders,
          friendlyNames: newFriendlyNames,
          associationKey: newAssociationKey,
      });
  };
  
  const handleSave = async () => {
      setIsSaving(true);
      try {
          const dataToSave: SupportData = { files: {} };
          for (const channelId in supportData.files) {
              const validFiles = supportData.files[channelId].filter(f => f.fileName && f.fileContent);
              if (validFiles.length > 0) {
                  const processedFiles = validFiles.map(file => {
                      const finalFriendlyNames: Record<string, string> = {};
                      // Ensure all headers are processed
                      file.headers.forEach(header => {
                          // If a friendly name exists and is not empty, use it. Otherwise, use the original header.
                          finalFriendlyNames[header] = file.friendlyNames[header]?.trim() || header;
                      });
                      return { ...file, friendlyNames: finalFriendlyNames };
                  }).filter(f => f.associationKey); // Finally, ensure the file has an association key
                  
                  if (processedFiles.length > 0) {
                      dataToSave.files[channelId] = processedFiles;
                  }
              }
          }
          await saveMonthlySupportData(monthYearKey, dataToSave);
          toast({ title: "Sucesso!", description: "Os dados de apoio para este mês foram salvos."});
          onClose();
      } catch (error) {
          console.error(error);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar os dados de apoio."});
      } finally {
          setIsSaving(false);
      }
  }
  
  const formatDate = (dateString: string) => {
      if (!dateString) return "Não carregado";
      return new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings /> Dados de Apoio para o Mês
          </DialogTitle>
          <DialogDescription>
            Anexe planilhas com dados complementares (frete, impostos, etc.) para o período selecionado. O sistema usará um campo chave para cruzar as informações.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
        ) : (
          <Tabs defaultValue={marketplaces[0].id} className="w-full flex-grow flex flex-col">
            <TabsList>
              {marketplaces.map((mp) => (
                <TabsTrigger key={mp.id} value={mp.id}>
                    <FileSpreadsheet className="mr-2" />
                  {mp.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex-grow overflow-y-auto pr-2 mt-4">
                {marketplaces.map((mp) => {
                    const filesForChannel = supportData.files[mp.id] || [];
                    return (
                        <TabsContent key={mp.id} value={mp.id} className="mt-0">
                             <Accordion type="multiple" className="w-full space-y-4">
                                {filesForChannel.map(fileData => {
                                    const stats = associationStats[fileData.id];
                                    return (
                                    <AccordionItem key={fileData.id} value={fileData.id} className="border-b-0">
                                        <Card>
                                             <div className="flex items-center w-full p-4">
                                                <AccordionTrigger className="p-0 hover:no-underline flex-grow">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div className="flex items-center gap-2">
                                                            {fileData.fileName ? <CheckCircle className="text-green-500" /> : <XCircle className="text-destructive"/>}
                                                            <span className="font-semibold">{fileData.fileName || "Novo Arquivo (não salvo)"}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm text-muted-foreground">
                                                                Inserido em: {formatDate(fileData.uploadedAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <Button variant="ghost" size="icon" className="ml-2 flex-shrink-0" onClick={(e) => {e.stopPropagation(); handleRemoveFile(mp.id, fileData.id);}}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                            <AccordionContent className="p-4 pt-0">
                                                <div className="flex flex-col sm:flex-row items-center gap-4 py-4 border-t">
                                                    <Input
                                                        id={`upload-${mp.id}-${fileData.id}`}
                                                        type="file"
                                                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                                        className="hidden"
                                                        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], mp.id, fileData.id)}
                                                    />
                                                    <Button asChild variant="outline">
                                                        <Label htmlFor={`upload-${mp.id}-${fileData.id}`} className="cursor-pointer">
                                                            <Upload className="mr-2" />
                                                            {fileData.fileName ? "Trocar Arquivo" : "Selecionar Arquivo"}
                                                        </Label>
                                                    </Button>
                                                    {stats && (
                                                      <div className="flex flex-col text-sm font-medium">
                                                          <span className="flex items-center gap-1.5 text-green-600">
                                                            {stats.associated} pedidos Associados <CheckCircle className="h-4 w-4" />
                                                          </span>
                                                          <span className="flex items-center gap-1.5 text-destructive">
                                                            {stats.notAssociated} pedidos não associados <XCircle className="h-4 w-4" />
                                                          </span>
                                                      </div>
                                                    )}
                                                </div>
                                                {fileData.headers?.length > 0 && (
                                                    <div className="space-y-4 p-4 border rounded-lg bg-background">
                                                        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-x-4 px-4 pb-2 border-b sticky top-0 bg-card z-10">
                                                            <div />
                                                            <h4 className="font-semibold text-sm text-muted-foreground">Coluna do Arquivo</h4>
                                                            <div />
                                                            <h4 className="font-semibold text-sm text-muted-foreground">Nome Amigável</h4>
                                                            <h4 className="font-semibold text-sm text-muted-foreground text-center">Chave de Associação</h4>
                                                        </div>
                                                        <ScrollArea className="h-[30vh]">
                                                            <RadioGroup 
                                                                value={fileData.associationKey} 
                                                                onValueChange={(value) => handleMappingChange(mp.id, fileData.id, { associationKey: value })}
                                                            >
                                                                {fileData.headers.map((header, index) => (
                                                                  <div key={`header-${index}-${header}`} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-x-4 py-2 pr-4">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveHeader(mp.id, fileData.id, header)}>
                                                                        <XCircle className="h-4 w-4"/>
                                                                    </Button>
                                                                    <Badge variant="secondary" className="font-normal justify-start py-2 truncate">{header}</Badge>
                                                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                                    <Input 
                                                                        placeholder={header}
                                                                        value={fileData.friendlyNames[header] || ""}
                                                                        onChange={(e) => handleMappingChange(mp.id, fileData.id, { friendlyNames: {...fileData.friendlyNames, [header]: e.target.value} })}
                                                                    />
                                                                    <div className="flex justify-center">
                                                                        <RadioGroupItem value={header} id={`radio-${mp.id}-${fileData.id}-${header}`} />
                                                                    </div>
                                                                  </div>
                                                                ))}
                                                            </RadioGroup>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                            </AccordionContent>
                                        </Card>
                                    </AccordionItem>
                                    )
                                })}
                            </Accordion>
                            <div className="mt-4">
                                <Button variant="secondary" onClick={() => handleAddNewFile(mp.id)} className="w-full border-dashed border">
                                    <PlusCircle className="mr-2" />
                                    Adicionar
                                </Button>
                            </div>
                        </TabsContent>
                    )
                })}
            </div>
          </Tabs>
        )}
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="animate-spin" />}
            <Save className="mr-2"/>
            Salvar Dados de Apoio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
