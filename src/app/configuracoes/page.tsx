
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Lock, UserPlus, ShieldCheck, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pagePermissions, availableRoles } from "@/lib/permissions";
import { saveAppSettings, loadAppSettings } from "@/services/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

// Mock data - Em uma implementação real, isso viria do Firebase (Auth + Firestore)
const mockUsers = [
  { id: '1', email: 'admin@fechamentto.com', role: 'admin' },
  { id: '2', email: 'expedicao@fechamentto.com', role: 'expedicao' },
  { id: '3', email: 'financeiro@fechamentto.com', role: 'financeiro' },
  { id: '4', email: 'sac@fechamentto.com', role: 'sac' },
];

export default function SettingsPage() {
    const [users, setUsers] = useState(mockUsers);
    const [permissions, setPermissions] = useState(pagePermissions);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    useEffect(() => {
        async function loadData() {
            const settings = await loadAppSettings();
            if (settings && settings.permissions) {
                setPermissions(settings.permissions);
            }
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

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            await saveAppSettings({ permissions: permissions });
            toast({
                title: "Permissões Salvas!",
                description: "As regras de acesso foram atualizadas."
            })
        } catch (e) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as permissões."})
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-[calc(100vh-200px)]"><Loader2 className="animate-spin" /><p className="ml-2">Carregando...</p></div>
    }

    return (
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
                    <CardDescription>Defina o que cada função pode ver e fazer no sistema.</CardDescription>
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.keys(permissions).filter(p => p !== '/login' && p !== '/perfil').map(page => (
                                    <TableRow key={page}>
                                        <TableCell className="font-medium">{page}</TableCell>
                                        {availableRoles.map(role => (
                                            <TableCell key={`${page}-${role.key}`} className="text-center">
                                                <Checkbox
                                                    checked={permissions[page].includes(role.key)}
                                                    onCheckedChange={(checked) => handlePermissionChange(page, role.key, !!checked)}
                                                    disabled={role.key === 'admin'}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter className="justify-end">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving && <Loader2 className="animate-spin"/>}
                        Salvar Alterações de Permissão
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Gestão de Usuários</CardTitle>
                    <CardDescription>
                        Atribua funções para controlar o acesso de cada usuário.
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
                                {users.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.email}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={user.role}
                                                onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
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
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                       (Em breve) A lista de usuários será carregada automaticamente do Firebase.
                    </p>
                </CardContent>
                <CardFooter className="justify-between items-center">
                     <Button variant="outline">
                        <UserPlus />
                        Adicionar Novo Usuário
                    </Button>
                    <Button disabled>
                        Salvar Alterações de Usuário
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
