
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, updateProfile, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUsername: (name: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser({ ...user }); // Create a new object to trigger re-renders
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const login = (email: string, pass: string) => {
      return signInWithEmailAndPassword(auth, email, pass);
  }

  const logout = async () => {
    await signOut(auth);
  };
  
  const updateUsername = async (name: string) => {
    if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
        // Manually update the user state to reflect the change immediately
        setUser(prevUser => prevUser ? ({ ...prevUser, displayName: name }) : null);
    } else {
        throw new Error("Nenhum usuário logado para atualizar.");
    }
  };
  
  const updateUserPassword = async (password: string) => {
    if (auth.currentUser) {
        await updatePassword(auth.currentUser, password);
    } else {
        throw new Error("Nenhum usuário logado para alterar a senha.");
    }
  }

  const value = {
    user,
    loading,
    login,
    logout,
    updateUsername,
    updateUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
