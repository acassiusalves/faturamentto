"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Lock } from "lucide-react";

export default function SettingsPage() {

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Configurações do Sistema</h1>
                <p className="text-muted-foreground">
                    Gerencie usuários, permissões e outras configurações globais.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> Gestão de Usuários</CardTitle>
                        <CardDescription>Adicione, remova ou edite os usuários que podem acessar o sistema.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                           (Em breve) Funcionalidade para gerenciar usuários diretamente pela interface.
                           Por enquanto, o gerenciamento é feito no Console do Firebase.
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lock /> Funções e Permissões</CardTitle>
                        <CardDescription>Defina o que cada tipo de usuário pode ver e fazer no sistema.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                           (Em breve) Funcionalidade para criar e atribuir funções (roles) com permissões específicas para cada tela.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
