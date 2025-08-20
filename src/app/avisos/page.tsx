
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Notice } from '@/lib/types';
import { saveNotice, loadNotices, deleteNotice } from '@/services/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, PlusCircle, Megaphone, Trash2, Pencil, Info, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { availableRoles } from '@/lib/permissions';


const noticeSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres."),
  message: z.string().min(10, "A mensagem deve ter pelo menos 10 caracteres."),
  type: z.enum(['info', 'warning', 'success', 'destructive']),
  dateRange: z.object({
    from: z.date({ required_error: "A data de início é obrigatória." }),
    to: z.date({ required_error: "A data de término é obrigatória." }),
  }),
  targetRoles: z.array(z.string()).min(1, "Selecione pelo menos uma função de destino."),
  isActive: z.boolean(),
});

type NoticeFormValues = z.infer<typeof noticeSchema>;

export default function NoticesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "info",
      targetRoles: [],
      isActive: true,
    },
  });

  const { handleSubmit, control, reset, setValue } = form;

  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    const loadedNotices = await loadNotices();
    setNotices(loadedNotices);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleEditClick = (notice: Notice) => {
    setEditingNotice(notice);
    setValue("title", notice.title);
    setValue("message", notice.message);
    setValue("type", notice.type);
    setValue("dateRange", {
      from: parseISO(notice.startDate),
      to: parseISO(notice.endDate),
    });
    setValue("targetRoles", notice.targetRoles);
    setValue("isActive", notice.isActive);
  };

  const handleCancelEdit = () => {
    setEditingNotice(null);
    reset({
      title: "",
      message: "",
      type: "info",
      targetRoles: [],
      isActive: true,
      dateRange: undefined,
    });
  };

  const handleDelete = async (noticeId: string) => {
    await deleteNotice(noticeId);
    toast({ title: "Aviso Apagado", description: "O aviso foi removido com sucesso." });
    await fetchNotices();
  };

  const onSubmit = async (data: NoticeFormValues) => {
    if (!user) return;
    if (!data.dateRange.from || !data.dateRange.to) {
        toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: "É obrigatório selecionar um período de exibição.",
        });
        return;
    }

    const noticeToSave: Partial<Notice> = {
      title: data.title,
      message: data.message,
      type: data.type,
      startDate: data.dateRange.from.toISOString(),
      endDate: data.dateRange.to.toISOString(),
      targetRoles: data.targetRoles as Notice['targetRoles'],
      isActive: data.isActive,
      createdBy: editingNotice?.createdBy || user.email || 'desconhecido',
      createdAt: editingNotice?.createdAt || new Date().toISOString(),
    };
    if (editingNotice) {
      noticeToSave.id = editingNotice.id;
    }
    await saveNotice(noticeToSave);
    toast({
      title: `Aviso ${editingNotice ? 'Atualizado' : 'Criado'}!`,
      description: `O aviso "${data.title}" foi salvo.`,
    });
    handleCancelEdit();
    await fetchNotices();
  };

  const noticeRoles = availableRoles.filter(r => r.key !== 'admin');

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Central de Avisos</h1>
        <p className="text-muted-foreground">Crie, edite e gerencie os avisos que serão exibidos para os usuários.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>{editingNotice ? 'Editar Aviso' : 'Criar Novo Aviso'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Controller
                  name="title"
                  control={control}
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input id="title" placeholder="Ex: Manutenção Programada" {...field} />
                      {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                    </div>
                  )}
                />
                <Controller
                  name="message"
                  control={control}
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <Label htmlFor="message">Mensagem</Label>
                      <Textarea id="message" placeholder="Descreva o aviso em detalhes aqui..." {...field} rows={5} />
                      {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                    </div>
                  )}
                />
                 <Controller
                    name="type"
                    control={control}
                    render={({ field, fieldState }) => (
                         <div className="space-y-2">
                            <Label>Tipo de Aviso</Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                <SelectValue placeholder="Selecione um tipo..." />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="info">Informação</SelectItem>
                                <SelectItem value="warning">Aviso</SelectItem>
                                <SelectItem value="success">Sucesso</SelectItem>
                                <SelectItem value="destructive">Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                            {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                        </div>
                    )}
                />
                 <Controller
                    name="dateRange"
                    control={control}
                    render={({ field, fieldState }) => (
                        <div className="space-y-2">
                            <Label>Período de Exibição</Label>
                            <DateRangePicker date={field.value} onDateChange={field.onChange} />
                             {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                        </div>
                    )}
                 />
                 <Controller
                    name="targetRoles"
                    control={control}
                    render={({ field, fieldState }) => (
                        <div className="space-y-2">
                            <Label>Exibir para as Funções:</Label>
                            <div className="space-y-2 rounded-md border p-4">
                                {noticeRoles.map((role) => (
                                    <div key={role.key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`role-${role.key}`}
                                            checked={field.value?.includes(role.key)}
                                            onCheckedChange={(checked) => {
                                                const currentRoles = field.value || [];
                                                return checked
                                                ? field.onChange([...currentRoles, role.key])
                                                : field.onChange(currentRoles.filter((value) => value !== role.key))
                                            }}
                                        />
                                        <Label htmlFor={`role-${role.key}`} className="font-normal">{role.name}</Label>
                                    </div>
                                ))}
                            </div>
                            {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                        </div>
                    )}
                 />
                 <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor="is-active">Aviso Ativo</Label>
                             <Switch id="is-active" checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                    )}
                 />
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                 <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : (editingNotice ? <Pencil /> : <PlusCircle />)}
                    {editingNotice ? 'Salvar Alterações' : 'Criar Aviso'}
                </Button>
                {editingNotice && <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>Cancelar Edição</Button>}
              </CardFooter>
            </Card>
          </form>
        </div>
        <div className="md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Avisos Cadastrados</CardTitle>
                    <CardDescription>Lista de todos os avisos do sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead>Destino</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                ) : notices.length > 0 ? (
                                    notices.map(notice => (
                                        <TableRow key={notice.id}>
                                            <TableCell className="font-medium">{notice.title}</TableCell>
                                            <TableCell>
                                                <Badge variant={notice.isActive ? 'default' : 'destructive'} className={notice.isActive ? 'bg-green-600' : ''}>
                                                    {notice.isActive ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {format(parseISO(notice.startDate), 'dd/MM/yy')} - {format(parseISO(notice.endDate), 'dd/MM/yy')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {notice.targetRoles.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(notice)}><Pencil className="h-4 w-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                                            <AlertDialogDescription>Esta ação removerá o aviso permanentemente.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(notice.id)}>Sim, Apagar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum aviso cadastrado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
