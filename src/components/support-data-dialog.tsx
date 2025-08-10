
"use client";

import { useState, useEffect, useCallback } from "react";
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
import type { SupportData, SupportFile } from "@/lib/types";
import { loadMonthlySupportData, saveMonthlySupportData } from "@/services/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
  monthYearKey: string; // e.g., "2024-08"
}

export function SupportDataDialog({ isOpen, onClose, monthYearKey }: SupportDataDialogProps) {
  const [supportData, setSupportData] = useState<SupportData>({ files: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && monthYearKey) {
      setIsLoading(true);
      loadMonthlySupportData(monthYearKey)
        .then((data) => {
          if (data && data.files) {
            const sanitizedFiles: { [key: string]: SupportFile[] } = {};
            for (const channelId in data.files) {
              const fileData = data.files[channelId];
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
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, monthYearKey]);
  
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

    const processHeaders = (headers: string[], content: string) => {
        const fileList = supportData.files[channelId] || [];
        const updatedList = fileList.map(f => {
            if (f.id === fileId) {
                return {
                    ...f,
                    fileName: file.name,
                    fileContent: content,
                    headers: headers,
                    associationKey: headers.find(h => /pedido/i.test(h)) || "",
                    uploadedAt: new Date().toISOString()
                };
            }
            return f;
        });
        handleFileArrayChange(channelId, updatedList);
        toast({ title: `Arquivo ${file.name} lido com sucesso!` });
    };

    if (fileExtension === 'csv') {
        reader.onload = (e) => {
            const content = e.target?.result as string;
            Papa.parse(content, {
                preview: 1,
                complete: (results) => {
                    const headers = (results.data[0] as string[]).map((h) => removeAccents(h.trim()));
                    processHeaders(headers, content);
                },
            });
        };
        reader.readAsText(file);
    } else if (fileExtension === 'xlsx') {
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const headers = (json[0] || []).map(h => removeAccents(String(h).trim()));
            processHeaders(headers, JSON.stringify(json));
        };
        reader.readAsArrayBuffer(file);
    } else {
        toast({ variant: 'destructive', title: 'Tipo de Arquivo Inválido', description: 'Por favor, selecione um arquivo .csv ou .xlsx' });
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

      const newHeaders = currentFile.headers.filter(h => h !== headerToRemove);
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
          // Filter out empty/unconfigured files before saving
          const dataToSave: SupportData = { files: {} };
          for (const channelId in supportData.files) {
              const validFiles = supportData.files[channelId].filter(f => f.fileName && f.associationKey);
              if (validFiles.length > 0) {
                  dataToSave.files[channelId] = validFiles;
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
                             <Accordion type="multiple" className="w-full space-y-4" defaultValue={filesForChannel.map(f => f.id)}>
                                {filesForChannel.map(fileData => (
                                    <AccordionItem key={fileData.id} value={fileData.id} className="border-b-0">
                                        <Card>
                                             <AccordionTrigger className="p-4 hover:no-underline">
                                                <div className="flex justify-between items-center w-full">
                                                    <div className="flex items-center gap-2">
                                                        {fileData.fileName ? <CheckCircle className="text-green-500" /> : <XCircle className="text-destructive"/>}
                                                        <span className="font-semibold">{fileData.fileName || "Novo Arquivo (não salvo)"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm text-muted-foreground">
                                                            Inserido em: {formatDate(fileData.uploadedAt)}
                                                        </span>
                                                         <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleRemoveFile(mp.id, fileData.id);}}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 pt-0">
                                                <div className="flex items-center gap-4 py-4 border-t">
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
                                                </div>
                                                {/* A MUDANÇA ESTÁ AQUI */}
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
                                                                {fileData.headers.map(header => (
                                                                <div key={header} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-x-4 py-2 pr-4">
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
                                ))}
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
