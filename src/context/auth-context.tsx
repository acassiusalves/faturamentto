
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, updateProfile, updatePassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { pagePermissions as defaultPagePermissions } from '@/lib/permissions';
import { loadAppSettings } from '@/services/firestore';

interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: string;
    metadata: User['metadata'];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUsername: (name: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  pagePermissions: Record<string, string[]>;
  inactivePages: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagePermissions, setPagePermissions] = useState<Record<string, string[]>>(defaultPagePermissions);
  const [inactivePages, setInactivePages] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role from Firestore and settings
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        const [userDoc, appSettings] = await Promise.all([
            getDoc(userDocRef),
            loadAppSettings() // Load global permissions
        ]);
        
        const role = userDoc.exists() ? userDoc.data().role : 'expedicao'; // Default role if not set

        if (appSettings) {
             if (appSettings.permissions) {
                const dynamicPermissions = { ...defaultPagePermissions };
                for (const page in dynamicPermissions) {
                  if (appSettings.permissions[page]) {
                    dynamicPermissions[page] = appSettings.permissions[page];
                  }
                }
                
                // CRITICAL: Ensure admin always has access to all defined pages
                for(const page in dynamicPermissions) {
                    const roles = new Set(dynamicPermissions[page]);
                    roles.add('admin');
                    dynamicPermissions[page] = Array.from(roles);
                }
                setPagePermissions(dynamicPermissions);
            }
            if (appSettings.inactivePages) {
                setInactivePages(appSettings.inactivePages);
            }
        }


        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: role,
          metadata: firebaseUser.metadata,
        });
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
    pagePermissions,
    inactivePages,
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
