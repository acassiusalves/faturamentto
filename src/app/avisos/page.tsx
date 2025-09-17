
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Notice, PickingNotice, Sale } from '@/lib/types';
import { saveNotice, loadNotices, deleteNotice, savePickingNotice, loadPickingNotices, deletePickingNotice, loadSales } from '@/services/firestore';

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
import { Loader2, PlusCircle, Megaphone, Trash2, Pencil, Info, CheckCircle, XCircle, AlertTriangle, MessageSquareWarning } from 'lucide-react';
import { format, parseISO, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { availableRoles, navLinks } from '@/lib/permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect, type Option } from '@/components/ui/multi-select';


const noticeSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres."),
  message: z.string().min(10, "A mensagem deve ter pelo menos 10 caracteres."),
  type: z.enum(['info', 'warning', 'success', 'destructive']),
  dateRange: z.object({
    from: z.date({ required_error: "A data de início é obrigatória." }),
    to: z.date({ required_error: "A data de término é obrigatória." }),
  }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)."),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)."),
  targetRoles: z.array(z.string()).min(1, "Selecione pelo menos uma função de destino."),
  targetPages: z.array(z.string()).optional(),
  isActive: z.boolean(),
});

type NoticeFormValues = z.infer<typeof noticeSchema>;

const pickingNoticeSchema = z.object({
    targetStates: z.array(z.string()).min(1, "Selecione pelo menos um estado."),
    message: z.string().min(5, "A mensagem é obrigatória."),
    type: z.enum(['info', 'warning', 'destructive']).default('warning'),
    showOnce: z.boolean().default(true),
});

type PickingNoticeFormValues = z.infer<typeof pickingNoticeSchema>;


function GeneralNoticesTab() {
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
      targetPages: [],
      isActive: true,
      startTime: "00:00",
      endTime: "23:59",
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
    const startDate = parseISO(notice.startDate);
    const endDate = parseISO(notice.endDate);

    setValue("title", notice.title);
    setValue("message", notice.message);
    setValue("type", notice.type);
    setValue("dateRange", { from: startDate, to: endDate });
    setValue("startTime", format(startDate, 'HH:mm'));
    setValue("endTime", format(endDate, 'HH:mm'));
    setValue("targetRoles", notice.targetRoles);
    setValue("targetPages", notice.targetPages || []);
    setValue("isActive", notice.isActive);
  };

  const handleCancelEdit = () => {
    setEditingNotice(null);
    reset({
      title: "",
      message: "",
      type: "info",
      targetRoles: [],
      targetPages: [],
      isActive: true,
      dateRange: undefined,
      startTime: "00:00",
      endTime: "23:59",
    });
  };

  const handleDelete = async (noticeId: string) => {
    await deleteNotice(noticeId);
    toast({ title: "Aviso Apagado", description: "O aviso foi removido com sucesso." });
    await fetchNotices();
  };

  const onSubmit = async (data: NoticeFormValues) => {
    if (!user) return;
    if (!data.dateRange?.from || !data.dateRange?.to) {
        toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: "É obrigatório selecionar um período de exibição.",
        });
        return;
    }
    
    const [startHours, startMinutes] = data.startTime.split(':').map(Number);
    const [endHours, endMinutes] = data.endTime.split(':').map(Number);

    const finalStartDate = setMinutes(setHours(data.dateRange.from, startHours), startMinutes);
    const finalEndDate = setMinutes(setHours(data.dateRange.to, endHours), endMinutes);

    const noticeToSave: Partial<Notice> = {
      title: data.title,
      message: data.message,
      type: data.type,
      startDate: finalStartDate.toISOString(),
      endDate: finalEndDate.toISOString(),
      targetRoles: data.targetRoles as Notice['targetRoles'],
      targetPages: data.targetPages,
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
  const availablePages = navLinks.filter(l => l.href !== '/');
  
  return (
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
                <div className="space-y-2">
                  <Label>Período de Exibição</Label>
                  <Controller
                      name="dateRange"
                      control={control}
                      render={({ field, fieldState }) => (
                        <>
                          <DateRangePicker date={field.value} onDateChange={field.onChange} />
                          {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                        </>
                      )}
                  />
                  <div className="flex gap-4">
                      <Controller
                          name="startTime"
                          control={control}
                          render={({ field, fieldState }) => (
                              <div className="flex-1 space-y-1">
                                  <Label htmlFor="start-time" className="text-xs">Hora Início</Label>
                                  <Input id="start-time" type="time" {...field} />
                                  {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                              </div>
                          )}
                      />
                      <Controller
                          name="endTime"
                          control={control}
                          render={({ field, fieldState }) => (
                              <div className="flex-1 space-y-1">
                                  <Label htmlFor="end-time" className="text-xs">Hora Fim</Label>
                                  <Input id="end-time" type="time" {...field} />
                                   {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                              </div>
                          )}
                      />
                  </div>
                </div>

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
                    name="targetPages"
                    control={control}
                    render={({ field }) => (
                        <div className="space-y-2">
                            <Label>Exibir nas Páginas (opcional):</Label>
                             <p className="text-xs text-muted-foreground">Se nenhuma página for selecionada, o aviso aparecerá em todas.</p>
                            <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                                {availablePages.map((page) => (
                                    <div key={page.href} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`page-${page.href}`}
                                            checked={field.value?.includes(page.href)}
                                            onCheckedChange={(checked) => {
                                                const currentPages = field.value || [];
                                                return checked
                                                ? field.onChange([...currentPages, page.href])
                                                : field.onChange(currentPages.filter((value) => value !== page.href))
                                            }}
                                        />
                                        <Label htmlFor={`page-${page.href}`} className="font-normal">{page.label}</Label>
                                    </div>
                                ))}
                            </div>
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
                    <CardTitle>Avisos Gerais Cadastrados</CardTitle>
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
                                                {format(parseISO(notice.startDate), 'dd/MM/yy HH:mm')} - {format(parseISO(notice.endDate), 'dd/MM/yy HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {notice.targetRoles.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                                                    {notice.targetPages && notice.targetPages.length > 0 && notice.targetPages.map(page => <Badge key={page} variant="outline">{page}</Badge>)}
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
  )
}

function PickingNoticesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pickingNotices, setPickingNotices] = useState<PickingNotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableStates, setAvailableStates] = useState<Option[]>([]);

  const form = useForm<PickingNoticeFormValues>({
    resolver: zodResolver(pickingNoticeSchema),
    defaultValues: { targetStates: [], message: "", type: "warning", showOnce: true },
  });

  const { handleSubmit, control, reset } = form;

  const fetchPickingNotices = useCallback(async () => {
    setIsLoading(true);
    const [loadedNotices, allSales] = await Promise.all([
      loadPickingNotices(),
      loadSales(),
    ]);
    const statesFromSales = new Set<string>();
    allSales.forEach(sale => {
        const stateName = (sale as any).state_name;
        if (stateName) statesFromSales.add(stateName);
    });
    setAvailableStates(Array.from(statesFromSales).sort().map(s => ({ value: s, label: s })));
    setPickingNotices(loadedNotices);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPickingNotices();
  }, [fetchPickingNotices]);
  
  const onSubmit = async (data: PickingNoticeFormValues) => {
    const noticeToSave: Omit<PickingNotice, 'id'> = {
      ...data,
      timesShown: 0,
      isActive: true,
      createdBy: user?.email || "unknown",
      createdAt: new Date().toISOString(),
    };

    try {
      await savePickingNotice(noticeToSave);
      toast({ title: "Aviso de Picking Criado!", description: `Um aviso será exibido para pedidos dos estados selecionados.` });
      reset();
      await fetchPickingNotices();
    } catch (error) {
      toast({ variant: 'destructive', title: "Erro ao Salvar", description: "Não foi possível criar o aviso de picking." });
    }
  };
  
  const handleDelete = async (noticeId: string) => {
    try {
        await deletePickingNotice(noticeId);
        toast({ title: "Aviso de Picking Apagado" });
        await fetchPickingNotices();
    } catch (error) {
        toast({ variant: 'destructive', title: "Erro ao Apagar" });
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Criar Aviso por Estado</CardTitle>
                <CardDescription>Esta mensagem aparecerá na tela de picking para pedidos dos estados selecionados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Controller
                    control={control}
                    name="targetStates"
                    render={({ field, fieldState }) => (
                        <div className="space-y-2">
                          <Label>Estados de Destino</Label>
                          <MultiSelect
                            options={availableStates}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Selecione os estados..."
                          />
                           {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                        </div>
                    )}
                />
                <Controller
                  name="message"
                  control={control}
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <Label htmlFor="picking-message">Mensagem do Aviso</Label>
                      <Textarea id="picking-message" placeholder="Ex: Cliente pediu para enviar sem nota fiscal." {...field} />
                      {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                    </div>
                  )}
                />
                <div className="flex gap-4">
                     <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                             <div className="space-y-2 flex-1">
                                <Label>Tipo</Label>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="info">Info</SelectItem>
                                        <SelectItem value="warning">Aviso</SelectItem>
                                        <SelectItem value="destructive">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    />
                     <Controller
                        name="showOnce"
                        control={control}
                        render={({ field }) => (
                            <div className="flex items-center justify-between rounded-lg border p-3 flex-1">
                                <div className="space-y-0.5">
                                    <Label htmlFor="show-once">Exibir só 1 vez</Label>
                                </div>
                                <Switch id="show-once" checked={field.value} onCheckedChange={field.onChange} />
                            </div>
                        )}
                    />
                </div>
              </CardContent>
              <CardFooter>
                 <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                    Salvar Aviso
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
        <div className="md:col-span-2">
             <Card>
                <CardHeader>
                    <CardTitle>Avisos de Picking Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Estados Alvo</TableHead>
                                    <TableHead>Mensagem</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="text-center">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                ) : pickingNotices.length > 0 ? (
                                    pickingNotices.map(notice => (
                                        <TableRow key={notice.id}>
                                            <TableCell className="w-1/3">
                                                <div className="flex flex-wrap gap-1">
                                                    {notice.targetStates.map(state => <Badge key={state} variant="secondary">{state}</Badge>)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{notice.message}</TableCell>
                                            <TableCell><Badge variant={notice.type === 'destructive' ? 'destructive' : 'secondary'}>{notice.type}</Badge></TableCell>
                                            <TableCell className="text-center">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Apagar este aviso?</AlertDialogTitle>
                                                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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
                                     <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum aviso de picking cadastrado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  )
}

export default function NoticesPage() {

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Central de Avisos</h1>
        <p className="text-muted-foreground">Crie, edite e gerencie os avisos que serão exibidos para os usuários do sistema.</p>
      </div>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">
                <Megaphone className="mr-2" />
                Avisos Gerais
            </TabsTrigger>
            <TabsTrigger value="picking">
                <MessageSquareWarning className="mr-2" />
                Avisos por Estado (Picking)
            </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6">
            <GeneralNoticesTab />
        </TabsContent>
        <TabsContent value="picking" className="mt-6">
            <PickingNoticesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
