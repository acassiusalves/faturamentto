
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, User, KeyRound, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ProfilePage() {
    const { user, loading, updateUsername } = useAuth();
    const { toast } = useToast();
    const [displayName, setDisplayName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || "");
        }
    }, [user]);

    const handleNameSave = async () => {
        if (!user) return;
        setIsSavingName(true);
        try {
            await updateUsername(displayName);
            toast({
                title: "Sucesso!",
                description: "Seu nome de usuário foi atualizado.",
            });
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

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        try {
            await sendPasswordResetEmail(auth, user.email);
            toast({
                title: "E-mail de Redefinição Enviado!",
                description: "Verifique sua caixa de entrada para alterar sua senha.",
            });
        } catch (error: any) {
            console.error("Erro ao enviar e-mail de redefinição de senha:", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível enviar o e-mail de redefinição de senha. Tente novamente mais tarde.",
            });
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

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><User />Informações da Conta</CardTitle>
                        <CardDescription>Seus dados de usuário no sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="displayName">Nome de Usuário</Label>
                            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user.email || ""} readOnly disabled />
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
                         <CardDescription>Gerencie a segurança da sua conta.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Clique no botão abaixo para receber um e-mail com as instruções para redefinir sua senha. Você será desconectado após solicitar a redefinição.
                        </p>
                         <Button onClick={handlePasswordReset}>
                            Alterar Senha
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
