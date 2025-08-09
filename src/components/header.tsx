"use client"
import Link from "next/link";
import { Settings, LayoutDashboard, PiggyBank, Warehouse, PackagePlus, PackageCheck, Archive, Map } from 'lucide-react';
import { MarketFlowLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function Header() {
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
                <Button asChild variant="ghost" size="sm" >
                    <Link href="/">
                        <LayoutDashboard className="mr-2" />
                        Dashboard
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/produtos">
                        <PackagePlus className="mr-2" />
                        Produtos
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/estoque">
                        <Warehouse className="mr-2" />
                        Estoque
                    </Link>
                </Button>
                 <Button asChild variant="ghost" size="sm">
                    <Link href="/picking">
                        <PackageCheck className="mr-2" />
                        Picking
                    </Link>
                </Button>
                 <Button asChild variant="ghost" size="sm">
                    <Link href="/arquivo">
                        <Archive className="mr-2" />
                        Arquivo
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/custos">
                        <PiggyBank className="mr-2" />
                        Custos
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/mapeamento">
                        <Map className="mr-2" />
                        Mapeamento
                    </Link>
                </Button>
            </nav>
        </header>
    )
}
