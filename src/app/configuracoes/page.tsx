
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Lock, UserPlus, ShieldCheck, Loader2 } from "lucide-react";
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
                    for (const page in mergedPermissions) {
                        if (settings.permissions[page]) {
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
                    <div className="rounded-md border overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Página do Sistema</TableHead>
                                    {availableRoles.map(role => (
                                        <TableHead key={role.key} className="text-center">{role.name}</TableHead>
                                    ))}
                                    <TableHead className="text-center">Ativa</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.keys(permissions).filter(p => p !== '/login' && p !== '/perfil').map(page => (
                                    <TableRow key={page}>
                                        <TableCell className="font-medium">{page}</TableCell>
                                        {availableRoles.map(role => {
                                            const isSuperUser = role.key === 'admin';
                                            const isChecked = isSuperUser || permissions[page]?.includes(role.key);
                                            return (
                                                <TableCell key={`${page}-${role.key}`} className="text-center">
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => handlePermissionChange(page, role.key, !!checked)}
                                                        disabled={isSuperUser}
                                                    />
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={!inactivePages.includes(page)}
                                                onCheckedChange={(checked) => handlePageActiveChange(page, checked)}
                                                disabled={page === '/configuracoes'} // prevent locking out
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
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
                                    <TableHead className="w-[180px]">Função (Role)</TableHead>
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
