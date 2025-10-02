
"use client";

import { useAuth } from '@/context/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './header';
import type { Notice } from '@/lib/types';
import { loadNotices } from '@/services/firestore';
import { NoticesDisplay } from './notices-display';
import { parseISO } from 'date-fns';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

// Helper function to find the first page the user has access to
function getFirstAccessiblePage(pagePermissions: Record<string, string[]>, userRole: string, inactivePages: string[]): string {
  // Priority order of pages to check
  const priorityPages = ['/', '/produtos', '/estoque', '/feed-25', '/analise-por-conta'];

  // First check priority pages
  for (const page of priorityPages) {
    const allowedRoles = pagePermissions[page];
    if (allowedRoles && allowedRoles.includes(userRole) && !inactivePages.includes(page)) {
      return page;
    }
  }

  // If no priority page is accessible, find any accessible page
  for (const [page, allowedRoles] of Object.entries(pagePermissions)) {
    if (page !== '/login' && page !== '/perfil' && !page.startsWith('/actions/')) {
      if (allowedRoles.includes(userRole) && !inactivePages.includes(page)) {
        return page;
      }
    }
  }

  // Fallback to profile page
  return '/perfil';
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading, pagePermissions, inactivePages } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [activeNotices, setActiveNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (loading) return; 

    const isLoginPage = pathname === '/login';

    if (!user) {
        if (!isLoginPage) {
            router.push('/login');
        }
        return;
    }

    // --- Notice Fetching and Filtering Logic ---
    async function fetchAndFilterNotices() {
        if(user && user.role) {
            const allNotices = await loadNotices();
            const now = new Date();

            const filtered = allNotices.filter(notice => {
                const startDate = parseISO(notice.startDate);
                const endDate = parseISO(notice.endDate);

                const isTimeActive = now >= startDate && now <= endDate;
                const isRoleTargeted = notice.targetRoles.includes(user.role);
                const isPageTargeted = !notice.targetPages || notice.targetPages.length === 0 || notice.targetPages.includes(pathname);

                return notice.isActive && isTimeActive && isRoleTargeted && isPageTargeted;
            });
            setActiveNotices(filtered);
        }
    }
    fetchAndFilterNotices();
    
    // --- End of Notice Logic ---
    
    if (isLoginPage) {
        const firstPage = getFirstAccessiblePage(pagePermissions, user.role, inactivePages);
        router.push(firstPage);
        return;
    }
    
    const isNewUser = !user.displayName;
    const isProfilePage = pathname === '/perfil';

    if (isNewUser && !isProfilePage) {
        router.push('/perfil');
        return;
    }
    
    // Check if page is inactive
    if (inactivePages.includes(pathname)) {
        const firstPage = getFirstAccessiblePage(pagePermissions, user.role, inactivePages);
        router.push(firstPage);
        return;
    }

    // Role-based access control
    const allowedRoles = pagePermissions[pathname];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`Access Denied: User with role '${user.role}' tried to access '${pathname}'.`);
        const firstPage = getFirstAccessiblePage(pagePermissions, user.role, inactivePages);
        router.push(firstPage); 
        return;
    }

  }, [user, loading, router, pathname, pagePermissions, inactivePages]);

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

  if (pathname === '/login') {
      return <>{children}</>;
  }

  if (user) {
    const isFirstTimeSetup = !user.displayName && pathname === '/perfil';
    return (
      <div className="flex flex-col min-h-screen">
        {!isFirstTimeSetup && <Header />}
        <main className="flex-1 container mx-auto py-8">
          <NoticesDisplay notices={activeNotices} />
          {children}
        </main>
      </div>
    );
  }

  return null;
}
