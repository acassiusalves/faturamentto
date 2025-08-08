"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package } from "lucide-react"

import { cn } from "@/lib/utils"
import { MarketFlowLogo } from "@/components/icons"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-screen w-16 flex-col items-center border-r bg-background py-4">
      <TooltipProvider>
        <div className="flex flex-1 flex-col items-center gap-4">
          <Link href="/" className="mb-4">
            <MarketFlowLogo className="h-6 w-6 text-primary" />
          </Link>
          {links.map((link) => (
            <Tooltip key={link.name} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={link.href}
                  className={cn(
                    buttonVariants({
                      variant: pathname === link.href ? "default" : "ghost",
                      size: "icon",
                    }),
                    "h-10 w-10"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  <span className="sr-only">{link.name}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{link.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </aside>
  )
}
