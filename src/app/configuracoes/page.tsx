
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Lock, UserPlus, ShieldCheck, Loader2, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pagePermissions as defaultPagePermissions, availableRoles } from "@/lib/permissions";
import { saveAppSettings, loadAppSettings, loadUsersWithRoles, updateUserRole } from "@/services/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from "@/lib/types";
import { NewUserDialog } from "@/components/new-user-dialog";
import { getFunctions, httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [permissions, setPermissions] = useState(defaultPagePermissions);
    const [inactivePages, setInactivePages] = useState<string[]>([]);
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);
    const [isSavingUsers, setIsSavingUsers] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
    const { toast } = useToast();
    
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            const [settings, appUsers] = await Promise.all([
                loadAppSettings(),
                loadUsersWithRoles()
            ]);

            if (settings) {
                if (settings.permissions) {
                    const mergedPermissions = { ...defaultPagePermissions };
                    for (const page in settings.permissions) {
                       if (Object.prototype.hasOwnProperty.call(mergedPermissions, page)) {
                           mergedPermissions[page] = settings.permissions[page];
                       } else {
                           // Add new permission if it doesn't exist in default
                           mergedPermissions[page] = settings.permissions[page];
                       }
                    }
                    setPermissions(mergedPermissions);
                }
                if (settings.inactivePages) {
                    setInactivePages(settings.inactivePages);
                }
            }
            setUsers(appUsers);
            setIsLoading(false);
        }
        loadData();
    }, []);

    const handleRoleChange = (userId: string, newRole: string) => {
        setUsers(currentUsers =>
            currentUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
        );
    };
    
    const handlePermissionChange = (page: string, role: string, checked: boolean) => {
        setPermissions(prev => {
            const newPermissions = { ...prev };
            const pageRoles = newPermissions[page] || [];
            if (checked) {
                if (!pageRoles.includes(role)) {
                    newPermissions[page] = [...pageRoles, role];
                }
            } else {
                newPermissions[page] = pageRoles.filter(r => r !== role);
            }
            return newPermissions;
        });
    };

    const handlePageActiveChange = (page: string, isActive: boolean) => {
        setInactivePages(prev => {
            const newInactive = new Set(prev);
            if (isActive) {
                newInactive.delete(page);
            } else {
                newInactive.add(page);
            }
            return Array.from(newInactive);
        });
    };


    const handleSavePermissions = async () => {
        setIsSavingPermissions(true);
        try {
            await saveAppSettings({ permissions: permissions, inactivePages: inactivePages });
            toast({
                title: "Permissões Salvas!",
                description: "As regras de acesso foram atualizadas. Pode ser necessário que os usuários recarreguem a página para ver as mudanças."
            })
        } catch (e) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as permissões."})
        } finally {
            setIsSavingPermissions(false);
        }
    };
    
    const handleSaveUsers = async () => {
        setIsSavingUsers(true);
        try {
            const updatePromises = users.map(user => updateUserRole(user.id, user.role));
            await Promise.all(updatePromises);
            toast({
                title: "Funções Salvas!",
                description: "As funções dos usuários foram atualizadas com sucesso."
            });
        } catch (e) {
             toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as funções dos usuários."})
        } finally {
            setIsSavingUsers(false);
        }
    }
    
    const handleCreateUser = async (email: string, role: string) => {
        const inviteUser = httpsCallable(functions, 'inviteUser');
        try {
            const result = await inviteUser({ email, role });
            toast({
                title: "Sucesso!",
                description: (result.data as any).result || `Convite para ${email} enviado com sucesso.`,
            });
            // Recarregar lista de usuários para mostrar o novo membro
            const appUsers = await loadUsersWithRoles();
            setUsers(appUsers);
            setIsNewUserDialogOpen(false);
        } catch (error: any) {
             console.error("Erro ao convidar usuário:", error);
             toast({
                variant: "destructive",
                title: "Erro ao Enviar Convite",
                description: error.message || "Ocorreu um erro desconhecido."
             })
        }
    }
    
    const allRoutes = Object.keys(permissions);
    const pageRoutes = allRoutes.filter(p => !p.startsWith('/actions/'));
    const actionRoutesByPage = pageRoutes.reduce((acc, page) => {
        const pageSpecificActions = allRoutes.filter(action => {
            // Ação pertence a esta página se começar com o nome da página + /
            // Ex: /feed-25/buscar-mercado-livre/actions/create-listing
            // E a página é /feed-25/buscar-mercado-livre
            return action.startsWith(`${page}/`) && action.includes('/actions/');
        });
        if (pageSpecificActions.length > 0) {
            acc[page] = pageSpecificActions;
        }
        return acc;
    }, {} as Record<string, string[]>);


    if (isLoading) {
        return <div className="flex items-center justify-center h-[calc(100vh-200px)]"><Loader2 className="animate-spin" /><p className="ml-2">Carregando...</p></div>
    }

    return (
        <>
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Configurações do Sistema</h1>
                <p className="text-muted-foreground">
                    Gerencie usuários, funções, permissões e outras configurações globais.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock /> Permissões por Função</CardTitle>
                    <CardDescription>Defina o que cada função pode ver e fazer no sistema. A função de Administrador sempre tem acesso a tudo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-[1fr,repeat(7,100px),100px] items-center p-4 border-b font-medium text-muted-foreground text-sm">
                            <div className="pr-4">Página do Sistema</div>
                            {availableRoles.map(role => (
                                <div key={role.key} className="text-center">{role.name}</div>
                            ))}
                            <div className="text-center">Ativa</div>
                        </div>
                        <Accordion type="multiple" className="w-full">
                           {pageRoutes.filter(p => p !== '/login' && p !== '/perfil').map(page => {
                                    const subActions = actionRoutesByPage[page] || [];
                                    const hasSubActions = subActions.length > 0;
                                    
                                    const triggerContent = (
                                        <div className="grid grid-cols-[1fr,repeat(7,100px),100px] items-center w-full">
                                            <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className={cn("h-8 w-8 mr-2", !hasSubActions && "invisible", "group-data-[state=open]:rotate-180 transition-transform")}>
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                                <span>{page}</span>
                                            </div>
                                            {availableRoles.map(role => {
                                                const isSuperUser = role.key === 'admin';
                                                const isChecked = isSuperUser || permissions[page]?.includes(role.key);
                                                return (
                                                    <div key={`${page}-${role.key}`} className="text-center">
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => handlePermissionChange(page, role.key, !!checked)}
                                                            disabled={isSuperUser}
                                                            onClick={(e) => e.stopPropagation()} // Prevent accordion from toggling
                                                        />
                                                    </div>
                                                );
                                            })}
                                            <div className="text-center">
                                                <Switch
                                                    checked={!inactivePages.includes(page)}
                                                    onCheckedChange={(checked) => handlePageActiveChange(page, checked)}
                                                    disabled={page === '/configuracoes'} // prevent locking out
                                                    onClick={(e) => e.stopPropagation()} // Prevent accordion from toggling
                                                />
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <AccordionItem value={page} key={page} className="border-b">
                                             <AccordionTrigger 
                                                className={cn("p-4 hover:no-underline hover:bg-muted/50 group", !hasSubActions && "cursor-default")}
                                                disabled={!hasSubActions}
                                             >
                                                {triggerContent}
                                             </AccordionTrigger>
                                             {hasSubActions && (
                                                <AccordionContent>
                                                    <div className="bg-muted/50 p-4 border-t">
                                                        {subActions.map(action => (
                                                             <div key={action} className="grid grid-cols-[1fr,repeat(7,100px),100px] items-center py-2">
                                                                 <div className="pl-14 text-sm text-muted-foreground italic truncate">
                                                                    └ Ação: {action.split('/').pop()}
                                                                 </div>
                                                                 {availableRoles.map(role => {
                                                                    const isSuperUser = role.key === 'admin';
                                                                    const isChecked = isSuperUser || permissions[action]?.includes(role.key);
                                                                    return (
                                                                         <div key={`${action}-${role.key}`} className="text-center">
                                                                            <Checkbox
                                                                                checked={isChecked}
                                                                                onCheckedChange={(checked) => handlePermissionChange(action, role.key, !!checked)}
                                                                                disabled={isSuperUser}
                                                                            />
                                                                        </div>
                                                                    )
                                                                 })}
                                                                 <div />
                                                             </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                             )}
                                        </AccordionItem>
                                    )
                                })}
                        </Accordion>
                    </div>
                </CardContent>
                 <CardFooter className="justify-end">
                    <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
                        {isSavingPermissions && <Loader2 className="animate-spin mr-2"/>}
                        Salvar Alterações de Permissão
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Gestão de Usuários</CardTitle>
                    <CardDescription>
                        Atribua funções para controlar o acesso de cada usuário. Apenas usuários com função definida no Firestore são listados aqui.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email do Usuário</TableHead>
                                    <TableHead className="w-[220px]">Função (Role)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length > 0 ? users.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.email || "Email não disponível"}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={user.role}
                                                onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                                                disabled={user.email?.toLowerCase().includes('admin@')}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a função" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableRoles.map(role => (
                                                        <SelectItem key={role.key} value={role.key}>
                                                            {role.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-24 text-center">Nenhum usuário encontrado no Firestore.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="justify-between items-center">
                     <Button variant="outline" onClick={() => setIsNewUserDialogOpen(true)}>
                        <UserPlus />
                        Adicionar Novo Usuário
                    </Button>
                    <Button onClick={handleSaveUsers} disabled={isSavingUsers}>
                         {isSavingUsers && <Loader2 className="animate-spin mr-2"/>}
                        Salvar Alterações de Usuário
                    </Button>
                </CardFooter>
            </Card>
        </div>
        
        <NewUserDialog
            isOpen={isNewUserDialogOpen}
            onClose={() => setIsNewUserDialogOpen(false)}
            onSave={handleCreateUser}
            availableRoles={availableRoles}
        />
        </>
    )
}

    