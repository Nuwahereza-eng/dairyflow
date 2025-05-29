
"use client";

import type { AuthenticatedUser, UserRole } from '@/types';
import { DUMMY_EMAIL_DOMAIN } from '@/types'; // Import the constant
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser // Renaming to avoid conflict with our User type
} from "firebase/auth";
import { app as firebaseApp } from '@/lib/firebase'; // Client-side Firebase app instance
import { initialUsers } from '@/lib/mockData'; // For Admin/Operator mock login

interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  login: (loginDetails: {role: UserRole, username: string, password: string}) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(firebaseApp); // Initialize client-side auth

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        console.log("Firebase Auth State Changed: User detected", firebaseUser);
        const authenticatedUser: AuthenticatedUser = {
          uid: firebaseUser.uid,
          username: firebaseUser.email?.replace(DUMMY_EMAIL_DOMAIN, '') || firebaseUser.phoneNumber || 'Farmer User',
          role: 'farmer',
          isFirebaseUser: true,
        };
        setCurrentUser(authenticatedUser);
        localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
      } else {
        console.log("Firebase Auth State Changed: No user. Checking localStorage for mock user.");
        const storedUserString = localStorage.getItem('currentUser');
        if (storedUserString) {
          try {
            const storedUser: AuthenticatedUser = JSON.parse(storedUserString);
            if (!storedUser.isFirebaseUser) {
              setCurrentUser(storedUser);
              console.log("Restored mock user from localStorage:", storedUser);
            } else {
              setCurrentUser(null);
              localStorage.removeItem('currentUser');
              console.log("Cleared Firebase user from localStorage as they are signed out from Firebase.");
            }
          } catch (error) {
            console.error("Failed to parse user from localStorage", error);
            localStorage.removeItem('currentUser');
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const login = async (loginDetails: {role: UserRole, username: string, password: string}) => {
    setIsLoading(true);
    const { role, username: rawUsername, password } = loginDetails;
    const username = rawUsername.trim(); // Trim whitespace from input username

    if (role === 'farmer') {
      try {
        const emailForFirebase = username + DUMMY_EMAIL_DOMAIN;
        console.log(`Attempting Firebase login for farmer with pseudo-email: ${emailForFirebase}`);
        const userCredential = await signInWithEmailAndPassword(auth, emailForFirebase, password);
        const firebaseUser = userCredential.user;
        const authenticatedUser: AuthenticatedUser = {
          uid: firebaseUser.uid,
          username: firebaseUser.email?.replace(DUMMY_EMAIL_DOMAIN, '') || 'Farmer',
          role: 'farmer',
          isFirebaseUser: true,
        };
        setCurrentUser(authenticatedUser);
        localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
        router.push('/dashboard');
      } catch (error: any) {
        console.error("Farmer Firebase login failed:", error);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        throw error;
      } finally {
        setIsLoading(false);
      }
    } else { // Admin or Operator (mock login)
      const foundUser = initialUsers.find(
        (u) => u.username === username && u.role === role
      );
      let passwordMatch = false;
      if (foundUser) {
        if (foundUser.username === 'admin' && password === 'adminpass') passwordMatch = true;
        if (foundUser.username === 'operator1' && password === 'op1pass') passwordMatch = true;
        // Add more specific mock user password checks if needed
      }

      if (foundUser && passwordMatch) {
        const authenticatedUser: AuthenticatedUser = {
          username: foundUser.username,
          role: foundUser.role as UserRole,
          isFirebaseUser: false,
        };
        setCurrentUser(authenticatedUser);
        localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
        router.push('/dashboard');
      } else {
         setCurrentUser(null);
         localStorage.removeItem('currentUser');
         throw new Error("Invalid credentials or role selection for Admin/Operator.");
      }
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    if (currentUser && currentUser.isFirebaseUser) {
      await signOut(auth);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    router.push('/login');
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
