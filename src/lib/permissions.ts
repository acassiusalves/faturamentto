

"use client";

import { LayoutDashboard, PackagePlus, Warehouse, PackageCheck, Archive, BarChart3, DollarSign, Map, Settings, User, FilePieChart, CheckSquare, ShoppingCart, Sparkles, Megaphone, Headset, BrainCircuit, LineChart, FileText, ListChecks, Tags, FileDown, BookImage, Search, Database, Beaker, Truck, ClipboardPaste, HardDrive, ArchiveRestore } from 'lucide-react';
import { MercadoLivreLogo, MagaluLogo } from '@/components/icons';

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
          { href: "/anuncios", label: "Anúncios Marketplace", icon: Megaphone },
      ]
    },
    {
      label: "Cadastro",
      icon: PackagePlus,
      subItems: [
        { href: "/produtos", label: "Produtos", icon: ShoppingCart },
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
        { href: "/arquivo/dados-mercado-livre", label: "Dados de Categoria (ML)", icon: Database },
        { href: "/arquivo/meus-anuncios-salvos", label: "Meus Anúncios Salvos", icon: HardDrive },
        { href: "/arquivo/analises-pdf-salvas", label: "Análises de PDF Salvas", icon: ArchiveRestore },
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
        { href: "/laboratorio/testes-magalu", label: "Testes Magalu", icon: MagaluLogo },
        { href: "/laboratorio/analise-zpl", label: "Análise de ZPL", icon: ClipboardPaste },
        { href: "/laboratorio/testes-gpt", label: "Testes GPT", icon: BrainCircuit },
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
    '/estoque/conferencia': ['admin', 'socio', 'financeiro', 'expedicao'],
    '/estoque/devolucoes': ['admin', 'socio', 'expedicao'],
    '/picking': ['admin', 'socio', 'expedicao'],
    '/conciliacao': ['admin', 'socio', 'financeiro'],
    '/compras': ['admin', 'socio', 'financeiro'],
    '/arquivo': ['admin', 'socio', 'expedicao', 'sac', 'financeiro'],
    '/arquivo/conferencia': ['admin', 'socio', 'financeiro'],
    '/arquivo/status-ideris': ['admin', 'socio', 'financeiro', 'sac'],
    '/arquivo/dados-mercado-livre': ['admin', 'socio', 'financeiro'],
    '/arquivo/dados-frete-mercado-livre': ['admin', 'socio', 'financeiro'],
    '/arquivo/meus-anuncios-salvos': ['admin', 'socio', 'financeiro'],
    '/arquivo/analises-pdf-salvas': ['admin', 'socio', 'financeiro'],
    '/relatorios': ['admin', 'socio', 'financeiro'],
    '/dre': ['admin', 'socio', 'financeiro'],
    '/custos-geral': ['admin', 'socio', 'financeiro'],
    '/sac': ['admin', 'socio', 'sac'],
    '/memoria': ['admin'],
    '/mapeamento': ['admin', 'socio'],
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
    '/etiquetas': ['admin', 'socio', 'expedicao'],
    '/login': [], // Public page, no roles required
    '/laboratorio': ['admin', 'socio'],
    '/laboratorio/testes-mercado-livre': ['admin', 'socio'],
    '/laboratorio/testes-magalu': ['admin', 'socio'],
    '/laboratorio/analise-zpl': ['admin', 'socio'],
    '/laboratorio/testes-gpt': ['admin', 'socio'],
};

    