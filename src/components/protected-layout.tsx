
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
        router.push('/');
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
        router.push('/');
        return;
    }

    // Role-based access control
    const allowedRoles = pagePermissions[pathname];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`Access Denied: User with role '${user.role}' tried to access '${pathname}'.`);
        router.push('/'); // Redirect to dashboard if not permitted
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
