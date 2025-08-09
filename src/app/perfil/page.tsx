
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, User, KeyRound, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ProfilePage() {
    const { user, loading, updateUsername, updateUserPassword } = useAuth();
    const { toast } = useToast();
    const [displayName, setDisplayName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || "");
            if (!user.displayName) {
                setIsNewUser(true);
            }
        }
    }, [user]);

    const handleNameSave = async () => {
        if (!user || !displayName.trim()) {
            toast({
                variant: "destructive",
                title: "Campo Obrigatório",
                description: "O nome de usuário não pode estar em branco.",
            });
            return;
        }
        setIsSavingName(true);
        try {
            await updateUsername(displayName);
            toast({
                title: "Sucesso!",
                description: "Seu nome de usuário foi atualizado.",
            });
            setIsNewUser(false);
        } catch (error: any) {
            console.error("Erro ao atualizar nome:", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível atualizar seu nome de usuário.",
            });
        } finally {
            setIsSavingName(false);
        }
    };
    
    const handlePasswordSave = async () => {
        if (newPassword.length < 6) {
            toast({ variant: "destructive", title: "Senha muito curta", description: "A nova senha deve ter pelo menos 6 caracteres." });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ variant: "destructive", title: "Senhas não coincidem", description: "Os campos de nova senha e confirmação devem ser iguais." });
            return;
        }
        
        setIsSavingPassword(true);
        try {
            await updateUserPassword(newPassword);
            toast({ title: "Sucesso!", description: "Sua senha foi alterada." });
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
             console.error("Erro ao alterar senha:", error);
             toast({ variant: "destructive", title: "Erro ao alterar senha", description: "Pode ser necessário fazer login novamente para realizar esta operação." });
        } finally {
            setIsSavingPassword(false);
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "Não disponível";
        return new Date(dateString).toLocaleDateString('pt-BR', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="animate-spin" />
                <p className="ml-2">Carregando perfil...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Perfil do Usuário</h1>
                <p className="text-muted-foreground">
                    Veja as informações da sua conta e gerencie suas configurações.
                </p>
            </div>
            
             {isNewUser && (
                <Alert variant="default" className="border-primary">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-bold">Bem-vindo(a) ao Sistema!</AlertTitle>
                    <AlertDescription>
                        Este é o seu primeiro acesso. Por favor, defina um nome de usuário e altere sua senha para continuar.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><User />Informações da Conta</CardTitle>
                        <CardDescription>Seus dados de usuário no sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="displayName">Nome de Usuário</Label>
                            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Digite seu nome aqui" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user.email || ""} readOnly disabled />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="uid">UID do Usuário</Label>
                            <Input id="uid" value={user.uid} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="creation-date">Data de Criação da Conta</Label>
                            <Input id="creation-date" value={formatDate(user.metadata.creationTime)} readOnly disabled />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleNameSave} disabled={isSavingName}>
                            {isSavingName ? <Loader2 className="animate-spin" /> : <Save />}
                            Salvar Nome
                        </Button>
                    </CardFooter>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><KeyRound />Segurança</CardTitle>
                         <CardDescription>Defina uma nova senha de acesso.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="new-password">Nova Senha</Label>
                            <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha"/>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handlePasswordSave} disabled={isSavingPassword || !newPassword || !confirmPassword}>
                            {isSavingPassword ? <Loader2 className="animate-spin" /> : <Save />}
                            Salvar Nova Senha
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
