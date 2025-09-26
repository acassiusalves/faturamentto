
"use client";

import { LayoutDashboard, PackagePlus, Warehouse, PackageCheck, Archive, BarChart3, DollarSign, Map, Settings, User, FilePieChart, CheckSquare, ShoppingCart, Sparkles, Megaphone, Headset, BrainCircuit, LineChart, FileText, ListChecks, Tags, FileDown, BookImage, Search, Database, Beaker, Truck } from 'lucide-react';
import { MercadoLivreLogo } from '@/components/icons';

export const availableRoles = [
  { key: 'admin', name: 'Administrador' },
  { key: 'socio', name: 'Sócio' },
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
        { href: "/arquivo/dados-mercado-livre", label: "Dados Mercado Livre", icon: Database },
        { href: "/arquivo/dados-frete-mercado-livre", label: "Dados Frete Mercado Livre", icon: Truck },
      ]
    },
    { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
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
        { href: "/feed-25/analise-produtos-pdf", label: "Análise de Produtos PDF", icon: BookImage },
        { href: "/feed-25/buscar-mercado-livre", label: "Buscar Produtos ML", icon: Search },
        { href: "/feed-25/buscar-categoria-mercado-livre", label: "Buscar Categoria ML", icon: Search },
      ]
    },
    { 
      label: "Laboratório", 
      icon: Beaker,
      subItems: [
        { href: "/laboratorio", label: "Painel do Laboratório", icon: Beaker },
        { href: "/laboratorio/testes-mercado-livre", label: "Testes Mercado Livre", icon: MercadoLivreLogo },
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
    '/': ['admin', 'socio', 'financeiro', 'expedicao', 'sac'],
    '/analise-por-conta': ['admin', 'socio', 'financeiro'],
    '/produtos': ['admin', 'socio', 'financeiro', 'expedicao'],
    '/estoque': ['admin', 'socio', 'financeiro', 'expedicao'],
    '/picking': ['admin', 'socio', 'expedicao'],
    '/conciliacao': ['admin', 'socio', 'financeiro'],
    '/compras': ['admin', 'socio', 'financeiro'],
    '/arquivo': ['admin', 'socio', 'expedicao', 'sac', 'financeiro'],
    '/arquivo/status-ideris': ['admin', 'socio', 'financeiro', 'sac'],
    '/arquivo/dados-mercado-livre': ['admin', 'socio', 'financeiro'],
    '/arquivo/dados-frete-mercado-livre': ['admin', 'socio', 'financeiro'],
    '/relatorios': ['admin', 'socio', 'financeiro'],
    '/dre': ['admin', 'socio', 'financeiro'],
    '/custos-geral': ['admin', 'socio', 'financeiro'],
    '/sac': ['admin', 'socio', 'sac'],
    '/memoria': ['admin'],
    '/mapeamento': ['admin'],
    '/aprovacoes': ['admin', 'socio'],
    '/configuracoes': ['admin'],
    '/perfil': ['admin', 'socio', 'financeiro', 'expedicao', 'sac'],
    '/feed-25': ['admin', 'socio'],
    '/feed-25/lista': ['admin', 'socio'],
    '/feed-25/analise-produtos-pdf': ['admin', 'socio'],
    '/feed-25/buscar-mercado-livre': ['admin', 'socio'],
    '/feed-25/buscar-categoria-mercado-livre': ['admin', 'socio'],
    '/avisos': ['admin'],
    '/anuncios': ['admin', 'socio'],
    '/etiquetas': ['admin', 'socio'],
    '/login': [], // Public page, no roles required
    '/laboratorio': ['admin', 'socio'],
    '/laboratorio/testes-mercado-livre': ['admin', 'socio'],
};
