
"use client";

import { LayoutDashboard, PackagePlus, Warehouse, PackageCheck, Archive, BarChart3, DollarSign, Map, Settings, User, FilePieChart, CheckSquare, ShoppingCart, Sparkles, Megaphone, Headset, BrainCircuit } from 'lucide-react';

export const availableRoles = [
  { key: 'admin', name: 'Administrador' },
  { key: 'financeiro', name: 'Financeiro' },
  { key: 'expedicao', name: 'Expedição' },
  { key: 'sac', name: 'SAC' },
];

export const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/produtos", label: "Produtos", icon: PackagePlus },
    { href: "/estoque", label: "Estoque", icon: Warehouse },
    { href: "/picking", label: "Picking", icon: PackageCheck },
    { href: "/conciliacao", label: "Conciliação", icon: FilePieChart },
    { href: "/compras", label: "Compras", icon: ShoppingCart },
    { href: "/arquivo", label: "Arquivo", icon: Archive },
    { href: "/dre", label: "DRE", icon: BarChart3 },
    { href: "/custos-geral", label: "Custos", icon: DollarSign },
    { href: "/sac", label: "SAC", icon: Headset },
    { href: "/memoria", label: "Memória", icon: BrainCircuit },
    { href: "/mapeamento", label: "Mapeamento", icon: Map },
    { href: "/aprovacoes", label: "Aprovações", icon: CheckSquare },
    { href: "/feed-25", label: "Feed 25", icon: Sparkles },
    { href: "/avisos", label: "Avisos", icon: Megaphone },
];

export const settingsLinks = [
    { href: "/configuracoes", title: "Configurações", icon: Settings },
    { href: "/perfil", title: "Perfil", icon: User },
];

// Default permissions, will be overridden by Firestore settings if they exist.
export const pagePermissions: Record<string, string[]> = {
    // Page route: Allowed roles
    '/': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/produtos': ['admin', 'expedicao'],
    '/estoque': ['admin', 'expedicao'],
    '/picking': ['admin', 'expedicao'],
    '/conciliacao': ['admin', 'financeiro'],
    '/compras': ['admin', 'financeiro'],
    '/arquivo': ['admin', 'expedicao', 'sac', 'financeiro'],
    '/dre': ['admin', 'financeiro'],
    '/custos-geral': ['admin', 'financeiro'],
    '/sac': ['admin', 'sac'],
    '/memoria': ['admin', 'financeiro'],
    '/mapeamento': ['admin'],
    '/aprovacoes': ['admin'],
    '/configuracoes': ['admin'],
    '/perfil': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/feed-25': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/avisos': ['admin'],
    '/login': [], // Public page, no roles required
};
