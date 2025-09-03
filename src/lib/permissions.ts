
"use client";

import { LayoutDashboard, PackagePlus, Warehouse, PackageCheck, Archive, BarChart3, DollarSign, Map, Settings, User, FilePieChart, CheckSquare, ShoppingCart, Sparkles, Megaphone, Headset, BrainCircuit, LineChart, FileText, ListChecks, Tags, FileDown, BookImage, Search } from 'lucide-react';

export const availableRoles = [
  { key: 'admin', name: 'Administrador' },
  { key: 'financeiro', name: 'Financeiro' },
  { key: 'expedicao', name: 'Expedição' },
  { key: 'sac', name: 'SAC' },
];

export const navLinks = [
    {
      href: "/",
      label: "Vendas",
      icon: LayoutDashboard,
      subItems: [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
          { href: "/analise-por-conta", label: "Análise por Conta", icon: LineChart },
          { href: "/sac", label: "SAC", icon: Headset },
          { href: "/conciliacao", label: "Conciliação", icon: FilePieChart },
          { href: "/etiquetas", label: "Etiquetas", icon: Tags },
      ]
    },
    {
      label: "Cadastro",
      icon: PackagePlus,
      subItems: [
        { href: "/produtos", label: "Produtos", icon: ShoppingCart },
        { href: "/anuncios", label: "Anúncios", icon: Megaphone },
        { href: "/avisos", label: "Avisos", icon: Megaphone },
      ]
    },
    { href: "/estoque", label: "Estoque", icon: Warehouse },
    { href: "/picking", label: "Picking", icon: PackageCheck },
    { href: "/compras", label: "Compras", icon: ShoppingCart },
    {
      label: "Arquivo",
      icon: Archive,
      subItems: [
        { href: "/arquivo", label: "Históricos de Atividades", icon: FileText },
        { href: "/arquivo/status-ideris", label: "Status Ideris", icon: ListChecks },
      ]
    },
    { href: "/dre", label: "DRE", icon: BarChart3 },
    { href: "/custos-geral", label: "Custos", icon: DollarSign },
    { href: "/memoria", label: "Memória", icon: BrainCircuit },
    { href: "/aprovacoes", label: "Aprovações", icon: CheckSquare },
    {
      label: "Feed 25",
      icon: Sparkles,
      subItems: [
        { href: "/feed-25", label: "Processador de Listas", icon: Sparkles },
        { href: "/feed-25/lista", label: "Feed Comparativo", icon: ListChecks },
        { href: "/feed-25/catalogo-pdf", label: "Catálogo PDF", icon: BookImage },
        { href: "/feed-25/buscar-mercado-livre", label: "Buscar Mercado Livre", icon: Search },
      ]
    },
];

export const settingsLinks = [
    { 
      title: "Configurações", 
      icon: Settings,
      subItems: [
          { href: "/configuracoes", label: "Permissões", icon: Settings },
          { href: "/mapeamento", label: "Mapeamento", icon: Map },
      ]
    },
    { href: "/perfil", title: "Perfil", icon: User },
];

// Default permissions, will be overridden by Firestore settings if they exist.
export const pagePermissions: Record<string, string[]> = {
    // Page route: Allowed roles
    '/': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/analise-por-conta': ['admin', 'financeiro'],
    '/produtos': ['admin', 'expedicao'],
    '/estoque': ['admin', 'expedicao'],
    '/picking': ['admin', 'expedicao'],
    '/conciliacao': ['admin', 'financeiro'],
    '/compras': ['admin', 'financeiro'],
    '/arquivo': ['admin', 'expedicao', 'sac', 'financeiro'],
    '/arquivo/status-ideris': ['admin', 'financeiro', 'sac'],
    '/dre': ['admin', 'financeiro'],
    '/custos-geral': ['admin', 'financeiro'],
    '/sac': ['admin', 'sac'],
    '/memoria': ['admin', 'financeiro'],
    '/mapeamento': ['admin'],
    '/aprovacoes': ['admin'],
    '/configuracoes': ['admin'],
    '/perfil': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/feed-25': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/feed-25/lista': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/feed-25/catalogo-pdf': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/feed-25/buscar-mercado-livre': ['admin', 'financeiro', 'expedicao', 'sac'],
    '/avisos': ['admin'],
    '/anuncios': ['admin'],
    '/etiquetas': ['admin'],
    '/login': [], // Public page, no roles required
};
