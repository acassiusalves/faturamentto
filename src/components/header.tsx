
"use client"
import Link from "next/link";
import { LogOut, ChevronDown } from 'lucide-react';
import { MarketFlowLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAuth } from "@/context/auth-context";
import { navLinks, settingsLinks } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils";

export function Header() {
    const { user, logout, pagePermissions, inactivePages } = useAuth();

    if (!user) return null;

    const hasAccess = (href?: string) => {
        if (!href) return false;
        if (inactivePages.includes(href)) return false; // Hide if page is inactive
        const allowedRoles = pagePermissions[href];
        if (!allowedRoles) return false; // Default to deny if page not in config
        return allowedRoles.includes(user.role);
    };

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
                {navLinks.map(link => {
                    if (link.subItems) {
                        // Render dropdown if there are sub-items and user has access to at least one
                        const canAccessSubItems = link.subItems.some(sub => hasAccess(sub.href));
                        if (!canAccessSubItems) return null;

                        return (
                            <DropdownMenu key={link.href}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <link.icon className="mr-2" />
                                        {link.label}
                                        <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {link.subItems.filter(sub => hasAccess(sub.href)).map(subItem => (
                                        <DropdownMenuItem key={subItem.href} asChild>
                                            <Link href={subItem.href}>
                                                <subItem.icon className="mr-2" />
                                                {subItem.label}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    }
                    
                    // Render a normal link if it has access
                    if (hasAccess(link.href)) {
                        return (
                            <Button asChild variant="ghost" size="sm" key={link.href}>
                                <Link href={link.href!}>
                                    <link.icon className="mr-2" />
                                    {link.label}
                                </Link>
                            </Button>
                        )
                    }
                    
                    return null;
                })}
                
                <div className="flex items-center gap-1 border-l ml-2 pl-2">
                    {settingsLinks.filter(link => hasAccess(link.href)).map(link => (
                         <Button asChild variant="ghost" size="icon" title={link.title} key={link.href}>
                            <Link href={link.href}>
                                <link.icon />
                            </Link>
                        </Button>
                    ))}

                     <Button onClick={logout} variant="ghost" size="icon" title="Sair" className="text-destructive hover:text-destructive">
                        <LogOut />
                    </Button>
                </div>
            </nav>
        </header>
    )
}
