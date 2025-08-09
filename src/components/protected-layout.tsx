
"use client";

import { useAuth } from '@/context/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './header';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Don't do anything while loading

    // If not logged in and not on the login page, redirect to login
    if (!user && pathname !== '/login') {
      router.push('/login');
    }

    // If logged in and on the login page, redirect to dashboard
    if (user && pathname === '/login') {
      router.push('/');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // While redirecting, show a loader
  if ((!user && pathname !== '/login') || (user && pathname === '/login')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If the user is not logged in and is on the login page, render only the children (the login page itself)
  if (!user && pathname === '/login') {
    return <>{children}</>;
  }

  // If the user is logged in, render the main layout with header and content
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-8">
        {children}
      </main>
    </div>
  );
}
