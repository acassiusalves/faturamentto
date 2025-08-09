"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ScanLine, ShoppingCart, Archive, Map, DollarSign } from "lucide-react"

import { cn } from "@/lib/utils"
import { MarketFlowLogo } from "@/components/icons"

const links = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Estoque",
    href: "/estoque",
    icon: Package,
  },
  {
    name: "Picking",
    href: "/picking",
    icon: ScanLine,
  },
  {
    name: "Produtos",
    href: "/produtos",
    icon: ShoppingCart,
  },
   {
    name: "Mapeamento",
    href: "/mapeamento",
    icon: Map,
  },
  {
    name: "Arquivo",
    href: "/arquivo",
    icon: Archive,
  },
  {
    name: "Custos",
    href: "/custos",
    icon: DollarSign,
  }
]

export function TopNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container flex h-16 items-center">
            <Link href="/" className="mr-6 flex items-center gap-2">
                <MarketFlowLogo className="h-6 w-6 text-primary" />
                <span className="font-bold">MarketFlow</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
                {links.map((link) => (
                    <Link
                        key={link.name}
                        href={link.href}
                        className={cn(
                            "transition-colors hover:text-foreground/80",
                            pathname === link.href ? "text-foreground font-semibold" : "text-foreground/60"
                        )}
                    >
                    {link.name}
                    </Link>
                ))}
            </nav>
        </div>
    </header>
  )
}
