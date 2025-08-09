
"use client";

import { useAuth } from '@/context/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './header';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

const pagePermissions: Record<string, string[]> = {
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
    '/login': [], // Public page
};

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; 

    const isLoginPage = pathname === '/login';

    if (!user) {
        if (!isLoginPage) {
            router.push('/login');
        }
        return;
    }
    
    // User is logged in
    if (isLoginPage) {
        router.push('/');
        return;
    }
    
    const isNewUser = !user.displayName;
    const isProfilePage = pathname === '/perfil';

    if (isNewUser && !isProfilePage) {
        router.push('/perfil');
        return;
    }
    
    // Role-based access control
    const allowedRoles = pagePermissions[pathname];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`Access Denied: User with role '${user.role}' tried to access '${pathname}'.`);
        router.push('/'); // Redirect to dashboard if not permitted
        return;
    }

  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    return (
       <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user && pathname === '/login') {
    return <>{children}</>;
  }

  if (user) {
    const showHeader = !(!user.displayName && pathname !== '/perfil');
    return (
      <div className="flex flex-col min-h-screen">
        {showHeader && <Header />}
        <main className="flex-1 container mx-auto py-8">
          {children}
        </main>
      </div>
    );
  }

  return null;
}
