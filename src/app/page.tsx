"use client";

import { SalesDashboard } from '@/components/sales-dashboard';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { loadAppSettings, saveSales, loadSales } from '@/services/firestore';
import { fetchOrdersFromIderis } from '@/services/ideris';
import { Loader2 } from 'lucide-react';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);
  
  // Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  const autoSyncIderis = useCallback(async (isSilent: boolean = false) => {
    if (isSyncing) return;
    const settings = await loadAppSettings();
    if (!settings?.iderisPrivateKey || settings.iderisApiStatus !== 'valid') {
        if (!isSilent) {
            toast({ variant: 'destructive', title: 'Sincronização Pausada', description: 'Valide sua chave da Ideris na página de Mapeamento para buscar novos pedidos.'});
        }
        return;
    }

    setIsSyncing(true);
    if (!isSilent) {
        toast({ title: "Sincronizando...", description: "Buscando novos pedidos da Ideris em segundo plano." });
    }

    try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 1); // Check last 24 hours

        const existingSales = await loadSales();
        const existingSaleIds = existingSales.map(s => s.id);
        
        const newSales = await fetchOrdersFromIderis(settings.iderisPrivateKey, { from, to }, existingSaleIds);

        if (newSales.length > 0) {
            await saveSales(newSales);
             toast({
              title: "Painel Atualizado!",
              description: `${newSales.length} novo(s) pedido(s) foram importados da Ideris.`,
            });
        } else if (!isSilent) {
             toast({ title: "Tudo certo!", description: "Seu painel já está atualizado com os últimos pedidos." });
        }
        setLastSyncTime(new Date());
    } catch (error) {
        console.error("Auto-sync failed:", error);
    } finally {
        setIsSyncing(false);
    }
  }, [isSyncing, toast]);

  useEffect(() => {

    async function initializeDashboard() {
        const settings = await loadAppSettings();
        let isConfigured = false;
        
        if (settings?.iderisPrivateKey && settings.iderisApiStatus === 'valid') {
            isConfigured = true;
            if (!initialSyncDone) {
                await autoSyncIderis(true);
                setInitialSyncDone(true);
            }
        }

        if (!isConfigured) {
            toast({
                title: "Configuração Necessária",
                description: "É preciso configurar sua conexão de dados. Redirecionando...",
                variant: "destructive"
            });
            router.push('/mapeamento');
        } else {
            setIsReady(true);
        }
    }

    initializeDashboard();
    
  }, [router, toast, initialSyncDone, autoSyncIderis]);
  
  // Timer for auto-sync
  useEffect(() => {
    if (!isReady) return;

    const intervalId = setInterval(async () => {
      console.log("Iniciando rotina de sincronização automática no Dashboard...");
      const settings = await loadAppSettings();
      if (settings?.iderisPrivateKey && settings.iderisApiStatus === 'valid') {
        await autoSyncIderis(true); // Silent sync in background
      }
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isReady, autoSyncIderis]);


  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Verificando configuração...</p>
      </div>
    );
  }
  
  return <SalesDashboard isSyncing={isSyncing} lastSyncTime={lastSyncTime} />
}
