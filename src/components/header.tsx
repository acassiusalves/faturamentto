
"use client"
import Link from "next/link";
import { Settings, LayoutDashboard, PiggyBank, Warehouse, PackagePlus, PackageCheck, Archive, Map, BarChart3, LogOut, User, DollarSign } from 'lucide-react';
import { MarketFlowLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAuth } from "@/context/auth-context";

const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['admin', 'financeiro', 'expedicao', 'sac'] },
    { href: "/produtos", label: "Produtos", icon: PackagePlus, roles: ['admin', 'expedicao'] },
    { href: "/estoque", label: "Estoque", icon: Warehouse, roles: ['admin', 'expedicao'] },
    { href: "/picking", label: "Picking", icon: PackageCheck, roles: ['admin', 'expedicao'] },
    { href: "/arquivo", label: "Arquivo", icon: Archive, roles: ['admin', 'expedicao', 'sac'] },
    { href: "/dre", label: "DRE", icon: BarChart3, roles: ['admin', 'financeiro'] },
    { href: "/custos-geral", label: "Custos", icon: DollarSign, roles: ['admin', 'financeiro'] },
    { href: "/mapeamento", label: "Mapeamento", icon: Map, roles: ['admin'] },
];

const settingsLinks = [
    { href: "/configuracoes", title: "Configurações", icon: Settings, roles: ['admin'] },
    { href: "/perfil", title: "Perfil", icon: User, roles: ['admin', 'financeiro', 'expedicao', 'sac'] },
]

export function Header() {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
                <MarketFlowLogo className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold font-headline">
                    <span className="text-primary">Fechamen</span>
                    <span className="text-accent">tto</span>
                </h1>
            </Link>
            
            <nav className="ml-auto flex items-center gap-2">
                {navLinks.map(link => (
                    link.roles.includes(user.role) && (
                        <Button asChild variant="ghost" size="sm" key={link.href}>
                            <Link href={link.href}>
                                <link.icon className="mr-2" />
                                {link.label}
                            </Link>
                        </Button>
                    )
                ))}
                
                {settingsLinks.map(link => (
                    link.roles.includes(user.role) && (
                         <Button asChild variant="ghost" size="icon" title={link.title} key={link.href}>
                            <Link href={link.href}>
                                <link.icon />
                            </Link>
                        </Button>
                    )
                ))}

                 <Button onClick={logout} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <LogOut className="mr-2" />
                    Sair
                </Button>
            </nav>
        </header>
    )
}
