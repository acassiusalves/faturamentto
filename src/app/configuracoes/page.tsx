
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Lock, UserPlus, ShieldCheck, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Mock data - Em uma implementação real, isso viria do Firebase (Auth + Firestore)
const mockUsers = [
  { id: '1', email: 'admin@fechamentto.com', role: 'admin' },
  { id: '2', email: 'operador1@fechamentto.com', role: 'operador' },
  { id: '3', email: 'financeiro@fechamentto.com', role: 'financeiro' },
];

const availableRoles = [
  { key: 'admin', name: 'Administrador' },
  { key: 'operador', name: 'Operador de Estoque' },
  { key: 'financeiro', name: 'Financeiro' },
];

export default function SettingsPage() {
    const [users, setUsers] = useState(mockUsers);
    const [isSaving, setIsSaving] = useState(false);

    const handleRoleChange = (userId: string, newRole: string) => {
        setUsers(currentUsers =>
            currentUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
        );
    };

    const handleSaveChanges = () => {
        setIsSaving(true);
        // Em uma implementação real, aqui você salvaria as alterações no Firestore.
        setTimeout(() => {
            console.log("Saving new roles:", users);
            setIsSaving(false);
            // Idealmente, você teria um toast de sucesso aqui.
        }, 1500);
    };

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Configurações do Sistema</h1>
                <p className="text-muted-foreground">
                    Gerencie usuários, funções, permissões e outras configurações globais.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> Gestão de Usuários</CardTitle>
                        <CardDescription>
                            Adicione novos usuários e atribua funções para controlar o acesso ao sistema.
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
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                            {isSaving && <Loader2 className="animate-spin"/>}
                            Salvar Alterações
                        </Button>
                    </CardFooter>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lock /> Permissões por Função</CardTitle>
                        <CardDescription>Defina o que cada função pode ver e fazer no sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div>
                            <h3 className="font-semibold flex items-center gap-2">
                                <Badge>Administrador</Badge>
                            </h3>
                            <p className="text-sm text-muted-foreground pl-2 border-l-2 ml-2 mt-1">
                                Acesso total a todas as telas e configurações, incluindo gestão de usuários.
                            </p>
                       </div>
                       <div>
                            <h3 className="font-semibold flex items-center gap-2">
                                <Badge variant="secondary">Operador de Estoque</Badge>
                            </h3>
                            <p className="text-sm text-muted-foreground pl-2 border-l-2 ml-2 mt-1">
                                Acesso a: Dashboard, Produtos, Estoque, Picking e Arquivo.
                            </p>
                       </div>
                        <div>
                            <h3 className="font-semibold flex items-center gap-2">
                                <Badge variant="secondary">Financeiro</Badge>
                            </h3>
                            <p className="text-sm text-muted-foreground pl-2 border-l-2 ml-2 mt-1">
                                Acesso a: Dashboard, DRE e Custos.
                            </p>
                       </div>
                        <p className="text-xs text-muted-foreground pt-4">
                           (Em breve) Você poderá criar e personalizar as permissões para cada função.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
