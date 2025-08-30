"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, RotateCcw, User, MapPin, FileText, Loader2 } from 'lucide-react';
import type { AnalyzeLabelOutput } from '@/lib/types';

interface SimpleDataEditorProps {
  data: AnalyzeLabelOutput & {
    senderNeighborhood?: string;
    senderCityState?: string;
  };
  onDataChange: (newData: any) => void;
  onRegenerate: (data: any) => void;
  onReset: () => void;
  isProcessing?: boolean;
  hasChanges?: boolean;
}

export const SimpleDataEditor: React.FC<SimpleDataEditorProps> = ({
  data,
  onDataChange,
  onRegenerate,
  onReset,
  isProcessing = false,
  hasChanges = false
}) => {
  const [editedData, setEditedData] = useState(data);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEditedData(data);
  }, [data]);

  const updateField = (field: string, value: string) => {
    const newData = { ...editedData, [field]: value };
    setEditedData(newData);
    onDataChange(newData);
  };

  const handleRegenerate = () => {
    startTransition(() => {
        onRegenerate(editedData);
    });
  };

  const handleReset = () => {
    setEditedData(data);
    onReset();
  };
  
  const finalIsProcessing = isProcessing || isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText /> Dados da Etiqueta
            </CardTitle>
            <CardDescription>
              Edite os dados e regenere uma nova etiqueta
            </CardDescription>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              disabled={finalIsProcessing}
            >
              <RotateCcw className="mr-2 h-4 w-4"/>
              Restaurar
            </Button>
            
            <Button 
              onClick={handleRegenerate}
              disabled={finalIsProcessing || !hasChanges}
              className="flex items-center gap-2"
            >
              {finalIsProcessing ? <Loader2 className="animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Regenerar Etiqueta
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Informações do Pedido */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <FileText size={16} /> Informações do Pedido
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orderNumber">Número do Pedido</Label>
              <Input
                id="orderNumber"
                value={editedData.orderNumber || ''}
                onChange={(e) => updateField('orderNumber', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div>
              <Label htmlFor="invoiceNumber">Nota Fiscal</Label>
              <Input
                id="invoiceNumber"
                value={editedData.invoiceNumber || ''}
                onChange={(e) => updateField('invoiceNumber', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div>
              <Label htmlFor="trackingNumber">Código de Rastreio</Label>
              <Input
                id="trackingNumber"
                value={editedData.trackingNumber || ''}
                onChange={(e) => updateField('trackingNumber', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div>
              <Label htmlFor="estimatedDate">Data Estimada</Label>
              <Input
                id="estimatedDate"
                value={editedData.estimatedDeliveryDate || ''}
                onChange={(e) => updateField('estimatedDeliveryDate', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
          </div>
        </div>

        {/* Destinatário */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <User size={16} /> Destinatário
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="recipientName">Nome</Label>
              <Input
                id="recipientName"
                value={editedData.recipientName || ''}
                onChange={(e) => updateField('recipientName', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div>
              <Label htmlFor="streetAddress">Endereço</Label>
              <Input
                id="streetAddress"
                value={editedData.streetAddress || ''}
                onChange={(e) => updateField('streetAddress', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={editedData.city || ''}
                  onChange={(e) => updateField('city', e.target.value)}
                  disabled={finalIsProcessing}
                />
              </div>
              
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={editedData.state || ''}
                  onChange={(e) => updateField('state', e.target.value)}
                  disabled={finalIsProcessing}
                />
              </div>
              
              <div>
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  value={editedData.zipCode || ''}
                  onChange={(e) => updateField('zipCode', e.target.value)}
                  disabled={finalIsProcessing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Remetente */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <MapPin size={16} /> Remetente
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="senderName">Nome</Label>
              <Input
                id="senderName"
                value={editedData.senderName || ''}
                onChange={(e) => updateField('senderName', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div>
              <Label htmlFor="senderAddress">Endereço</Label>
              <Input
                id="senderAddress"
                value={editedData.senderAddress || ''}
                onChange={(e) => updateField('senderAddress', e.target.value)}
                disabled={finalIsProcessing}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="senderNeighborhood">Bairro e CEP</Label>
                <Input
                  id="senderNeighborhood"
                  value={editedData.senderNeighborhood || ''}
                  onChange={(e) => updateField('senderNeighborhood', e.target.value)}
                  disabled={finalIsProcessing}
                />
              </div>
              
              <div>
                <Label htmlFor="senderCityState">Cidade/Estado</Label>
                <Input
                  id="senderCityState"
                  value={editedData.senderCityState || ''}
                  onChange={(e) => updateField('senderCityState', e.target.value)}
                  disabled={finalIsProcessing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Aviso explicativo */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <Wand2 className="text-blue-600 mt-0.5" size={16} />
            <div className="flex-1 text-sm">
              <p className="font-medium text-blue-900">💡 Como Funciona</p>
              <p className="text-blue-700">
                <strong>1.</strong> Edite os campos acima conforme necessário<br/>
                <strong>2.</strong> Clique "Regenerar Etiqueta" para criar uma nova etiqueta<br/>
                <strong>3.</strong> Códigos de barras e layout são preservados automaticamente
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
