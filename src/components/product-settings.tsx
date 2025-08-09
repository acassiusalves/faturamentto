"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ProductCategorySettings, ProductAttribute } from '@/lib/types';
import { loadProductSettings, saveProductSettings } from '@/services/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, Loader2, Tag, Save } from 'lucide-react';

// For now, we only have one category, but this structure allows for more in the future.
const initialCategories: ProductCategorySettings[] = [
    {
        id: 'celular',
        name: 'Celulares',
        attributes: [
            { key: 'marca', label: 'Marca', values: ['Xiaomi', 'Realme', 'Motorola', 'Samsung', 'LG'] },
            { key: 'modelo', label: 'Modelo', values: [
                'Mi 11 Lite', 'Mi 11i', 'Mi 10T', 'Mi 10T Lite', 'Mi 10 Lite', 'Poco F5', 'Redmi Note 10', 'Redmi Note 10 Pro', 
                'Redmi Note 10S', 'Redmi Note 10 Pro Max', 'Redmi Note 10T', 'Redmi Note 9', 'Redmi Note 9 Pro', 'Redmi Note 9T', 
                'Redmi 9', 'Redmi 9i', 'Redmi 9 Prime', 'Redmi 9A', 'Redmi 9C', 'Redmi 9A Sport', 'Redmi 9C Sport', 'Redmi 9i Sport', 
                'Redmi 10', 'Redmi 9 Active', 'Redmi 10 Prime', 'Redmi 10 C', 'Redmi Note 8', 'Poco M5S', 'Poco M3', 'Poco C3', 
                'Poco X3', 'Poco F3', 'Poco X3 GT', 'Poco X3 Pro', 'Poco X3 NFC', 'Poco M4 Pro', 'Poco M3 Pro', 'Galaxy A33', 
                '7i', '6 Pro', 'Técno Spark 6 GO', 'Técno Canon 17', 'Redmi Note 11', 'Redmi 10C', 'Redmi 10A', 'Redmi Note 11 Pro', 
                'Redmi Note 11S', 'Poco F4', 'Moto G22', 'Poco C40', 'Poco X4 Pro', 'Galaxy A23', 'Poco M4', 'Galaxy A13', 
                '11T', 'Note 12 Pro', 'Poco X5', 'Note 12', 'Poco F4 GT', 'Poco X5 PRO', 'Note 12 Lite', 'Note 13 Lite', 
                'Redmi 12C', 'Samsung', '12s', 'Redmi 12', 'Redmi 13C', 'Note 13', 'Poco X6', 'C55', 'C53', 'C67', 
                'Power Bank', 'Note 13 Pro', 'Poco X6 Pro', 'Redmi 13', 'Moto G73', 'Redmi Pad', 'Redmi Pad SE', 'C61', 
                'Redmi 14C', 'Poco C65', 'Redmi A3', 'Note 50', 'A05', 'A06', 'A05S', 'Moto E14', 'Moto G04', 'Moto G04S', 
                'Moto G24', 'Moto G34', 'Tablet Samsung A9', 'Tablet Samsung A7', 'C65', 'C63', '12', 'Note 60', 'C11 2021', 
                'C51', 'C75', '12 Pro', '13 Plus', 'Poco C75', 'Poco M6 Pro', 'Poco X7 Pro', 'Note 14 Pro', 'Note 14', 
                'Redmi A3X', 'Note 13 Pro Plus', 'Note 14 Pro Plus', 'Note 60X', '12 Pro Plus', 'Poco F6 Pro', 'Poco F5 Pro', 
                'C75X', 'G35', 'G05', 'Note 14S', 'Poco X7', 'Redmi Pad Pro', 'Poco Pad'
            ]},
            { key: 'armazenamento', label: 'Armazenamento', values: ['32GB', '64GB', '128GB', '256GB', '512GB'] },
            { key: 'tipo', label: 'Tipo', values: ['Novo', 'Vitrine', 'Seminovo', 'Global'] },
            { key: 'memoria', label: 'Memória', values: ['4GB', '6GB', '8GB', '12GB'] },
            { key: 'cor', label: 'Cor', values: [
                'Preto', 'Branco', 'Verde', 'Dourado', 'Cinza', 'Roxo', 'Bronze', 'Laranja', 'Amarelo', 'Azul', 'Rosa', 'Vermelho', 
                'Prata', 'Star Blue', 'Twiligth Blue', 'Sky Blue', 'Onys Gray', 'Night Black', 'Cool Blue', 'Coral Green', 'Polar White', 'Silver'
            ]},
            { key: 'rede', label: 'Rede', values: ['4G', '5G'] },
        ]
    }
];

export function ProductSettings() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<ProductCategorySettings[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newOption, setNewOption] = useState<Record<string, string>>({}); // { [attributeKey]: "new value" }

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            const loadedSettingsPromises = initialCategories.map(cat => loadProductSettings(cat.id));
            const loadedSettings = await Promise.all(loadedSettingsPromises);
            
            const finalSettings: ProductCategorySettings[] = [];
            
            for (let i = 0; i < initialCategories.length; i++) {
                const cat = initialCategories[i];
                let saved = loadedSettings[i];

                // If no settings were saved for this category, save the initial default and use it.
                if (!saved) {
                    await saveProductSettings(cat.id, cat);
                    saved = cat; 
                     toast({
                        title: "Configurações Iniciais Criadas",
                        description: `As configurações padrão para ${cat.name} foram salvas.`,
                    });
                }
                
                // Merge to ensure all attributes exist and respect order
                const mergedAttributes = cat.attributes.map(defaultAttr => {
                   const savedAttr = saved!.attributes.find(sa => sa.key === defaultAttr.key);
                   if (savedAttr && savedAttr.values && savedAttr.values.length > 0) {
                       return savedAttr;
                   }
                   return defaultAttr;
                });
                
                const orderedAttributes = cat.attributes.map(defaultAttr => 
                    mergedAttributes.find(m => m.key === defaultAttr.key) || defaultAttr
                );
                finalSettings.push({ ...cat, attributes: orderedAttributes });
            }
            
            setSettings(finalSettings);
            setIsLoading(false);
        }
        loadData();
    }, [toast]);
    
    const handleAddOption = (categoryIndex: number, attributeIndex: number) => {
        const attrKey = settings[categoryIndex].attributes[attributeIndex].key;
        const inputValues = newOption[attrKey]?.trim();

        if (!inputValues) return;
        
        // Split by comma, newline, semicolon, or space
        const optionsToAdd = inputValues.split(/[,\n;\s]+/).map(opt => opt.trim()).filter(Boolean);

        if(optionsToAdd.length === 0) return;

        const newSettings = [...settings];
        const attribute = newSettings[categoryIndex].attributes[attributeIndex];
        let addedCount = 0;
        
        optionsToAdd.forEach(optionValue => {
            if (!attribute.values.includes(optionValue)) {
                attribute.values.push(optionValue);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            setSettings(newSettings);
        }
        
        setNewOption(prev => ({...prev, [attrKey]: ""}));
    };
    
    const handleRemoveOption = (categoryIndex: number, attributeIndex: number, optionToRemove: string) => {
        const newSettings = [...settings];
        const attribute = newSettings[categoryIndex].attributes[attributeIndex];
        attribute.values = attribute.values.filter(opt => opt !== optionToRemove);
        setSettings(newSettings);
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const savePromises = settings.map(setting => saveProductSettings(setting.id, setting));
            await Promise.all(savePromises);
            toast({
                title: "Configurações Salvas!",
                description: "Suas opções de atributos de produto foram salvas com sucesso."
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar as configurações.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="animate-spin" />
                <p className="ml-2">Carregando configurações...</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configurar Atributos de Produto</CardTitle>
                <CardDescription>Adicione as opções que estarão disponíveis ao criar um novo produto em cada categoria. Você pode colar uma lista de itens separados por vírgula, ponto e vírgula ou quebra de linha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                    {settings.map((category, catIndex) => (
                        <AccordionItem key={category.id} value={`item-${catIndex}`}>
                            <AccordionTrigger className="text-lg font-semibold">{category.name}</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                {category.attributes.map((attr, attrIndex) => (
                                    <div key={attr.key} className="p-4 border rounded-md">
                                        <h4 className="font-medium flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground"/>{attr.label}</h4>
                                        <div className="pl-6 pt-2">
                                            <div className="flex gap-2 mb-2">
                                                <Input 
                                                    placeholder={`Adicionar nova ${attr.label.toLowerCase()}...`} 
                                                    value={newOption[attr.key] || ""}
                                                    onChange={(e) => setNewOption(prev => ({ ...prev, [attr.key]: e.target.value }))}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(catIndex, attrIndex); }}}
                                                />
                                                <Button size="icon" onClick={() => handleAddOption(catIndex, attrIndex)}>
                                                    <PlusCircle />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {attr.values.length > 0 ? attr.values.map(option => (
                                                    <Badge key={option} variant="secondary" className="flex items-center gap-1.5 pr-1">
                                                        {option}
                                                        <button onClick={() => handleRemoveOption(catIndex, attrIndex, option)} className="rounded-full hover:bg-muted-foreground/20">
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                )) : <p className="text-xs text-muted-foreground italic">Nenhuma opção adicionada.</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                <div className="flex justify-end">
                    <Button onClick={handleSaveSettings} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                        Salvar Todas as Configurações
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
