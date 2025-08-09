"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight, Save, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { iderisFields } from '@/lib/ideris-fields'; // Assuming this holds Ideris field info

interface FriendlyMappingFormProps {
  initialNames: Record<string, string>;
  onSave: (names: Record<string, string>) => void;
}

export function FriendlyMappingForm({ initialNames, onSave }: FriendlyMappingFormProps) {
  const [friendlyNames, setFriendlyNames] = useState<Record<string, string>>(initialNames);

  useEffect(() => {
    setFriendlyNames(initialNames);
  }, [initialNames]);

  const handleNameChange = (fieldKey: string, newName: string) => {
    setFriendlyNames(prev => ({ ...prev, [fieldKey]: newName }));
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona?</AlertTitle>
            <AlertDescription>
            Esses nomes amigáveis serão usados para exibir os dados em todo o sistema, como no Dashboard e na Conciliação. Deixe em branco para usar o nome padrão da Ideris.
            </AlertDescription>
        </Alert>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-4 pb-2 border-b">
          <h4 className="font-semibold text-sm text-muted-foreground">Campo da Ideris</h4>
          <div />
          <h4 className="font-semibold text-sm text-muted-foreground">Nome Amigável (Opcional)</h4>
        </div>
        {iderisFields.map(field => (
          <div key={field.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
            <div className="flex flex-col">
              <span className="font-medium text-sm">{field.name}</span>
              <span className="text-xs text-muted-foreground">{field.description}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Input
              value={friendlyNames[field.key] || ''}
              onChange={e => handleNameChange(field.key, e.target.value)}
              placeholder={field.name}
            />
          </div>
        ))}
        <div className="flex justify-end pt-4">
          <Button onClick={() => onSave(friendlyNames)}>
            <Save className="mr-2" />
            Salvar Nomes Amigáveis