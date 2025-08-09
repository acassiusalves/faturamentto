
"use client";

import { LayoutDashboard, PackagePlus, Warehouse, PackageCheck, Archive, BarChart3, DollarSign, Map, Settings, User } from 'lucide-react';

export const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/produtos", label: "Produtos", icon: PackagePlus },
    { href: "/estoque", label: "Estoque", icon: Warehouse },
    { href: "/picking", label: "Picking", icon: PackageCheck },
    { href: "/arquivo", label: "Arquivo", icon: Archive },
    { href: "/dre", label: "DRE", icon: BarChart3 },
    { href: "/custos-geral", label: "Custos", icon: DollarSign },
    { href: "/mapeamento", label: "Mapeamento", icon: Map },
];

export const settingsLinks = [
    { href: "/configuracoes", title: "Configurações", icon: Settings },
    { href: "/perfil", title: "Perfil", icon: User },
];

export const pagePermissions: Record<string, string[]> = {
    // Page route: Allowed roles
    '/': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/produtos': ['admin', 'expedicao'],
    '/estoque': ['admin', 'expedicao'],
    '/picking': ['admin', 'expedicao'],
    '/arquivo': ['admin', 'expedicao', 'sac'],
    '/dre': ['admin', 'financeiro'],
    '/custos-geral': ['admin', 'financeiro'],
    '/mapeamento': ['admin'],
    '/configuracoes': ['admin'],
    '/perfil': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/login': [], // Public page, no roles required
};
