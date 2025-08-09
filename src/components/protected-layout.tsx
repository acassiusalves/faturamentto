
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

    const isLoginPage = pathname === '/login';
    const isProfilePage = pathname === '/perfil';
    
    // If not logged in and not on the login page, redirect to login
    if (!user && !isLoginPage) {
      router.push('/login');
      return;
    }

    if (user) {
        const isNewUser = !user.displayName;

        // If logged in and on the login page, redirect to dashboard
        if (isLoginPage) {
          router.push('/');
          return;
        }

        // If it's a new user (no display name) and they are NOT on the profile page,
        // force them to the profile page.
        if (isNewUser && !isProfilePage) {
            router.push('/perfil');
            return;
        }
    }
  }, [user, loading, router, pathname]);

  // Show a global loader while authentication is in progress
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If there's no user and we are not on the login page, we're likely redirecting. Show loader.
  if (!user && pathname !== '/login') {
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

  // If the user is logged in, render the main layout.
  // The logic inside useEffect handles redirection for new users.
  if (user) {
    const isNewUser = !user.displayName;
    // Don't render the main header if a new user is forced to the profile page
    const showHeader = !isNewUser || pathname === '/perfil';

    return (
      <div className="flex flex-col min-h-screen">
        {showHeader && <Header />}
        <main className="flex-1 container mx-auto py-8">
          {children}
        </main>
      </div>
    );
  }

  // Fallback for any edge cases (shouldn't be reached)
  return null;
}
