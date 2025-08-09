
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Loader2 } from 'lucide-react';
import type { availableRoles } from '@/lib/permissions';

const newUserSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  role: z.string().min(1, { message: "É obrigatório selecionar uma função." }),
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

interface NewUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (email: string, role: string) => Promise<void>;
  availableRoles: typeof availableRoles;
}

export function NewUserDialog({ isOpen, onClose, onSave, availableRoles }: NewUserDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: "",
      role: "expedicao", // Default role
    },
  });

  const handleSubmit = async (data: NewUserFormValues) => {
    setIsSaving(true);
    await onSave(data.email, data.role);
    // Don't close the dialog on error, let the user retry or see the error.
    // The parent component will close it on success.
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset();
      }
      onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Novo Usuário</DialogTitle>
          <DialogDescription>
            Insira o email e a função para criar um novo acesso e enviar um convite.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email do Novo Usuário</FormLabel>
                  <FormControl>
                    <Input placeholder="exemplo@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função (Permissão)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma função" />
                      </Trigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Alert variant="default" className="border-amber-500/50">
              <Info className="h-4 w-4" />
              <AlertTitle className="font-semibold">Como funciona?</AlertTitle>
              <AlertDescription>
                Ao salvar, um novo usuário será criado no Firebase com uma senha temporária. Idealmente, uma automação enviaria um email de boas-vindas para o novo usuário.
              </AlertDescription>
            </Alert>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin mr-2" />}
                Salvar e Convidar Usuário
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
