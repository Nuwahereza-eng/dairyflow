
"use client";

import type { AuthenticatedUser, UserRole } from '@/types';
import { FARMER_EMAIL_DOMAIN, ADMIN_EMAIL_DOMAIN, OPERATOR_EMAIL_DOMAIN } from '@/types';
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { app as firebaseApp } from '@/lib/firebase'; 

interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  login: (loginDetails: {role: UserRole, username: string, password: string}) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(firebaseApp); 

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        console.log("Firebase Auth State Changed: User detected", firebaseUser);
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult(true); // Force refresh for latest claims
          const userRoleFromClaims = idTokenResult.claims.role as UserRole;

          if (!userRoleFromClaims) {
            console.warn("User from Firebase Auth is missing 'role' custom claim. Treating as unauthenticated.");
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            setIsLoading(false);
            await signOut(auth); // Sign out user if role claim is missing
            return;
          }

          let plainUsername = firebaseUser.displayName || firebaseUser.uid;
          if (userRoleFromClaims === 'farmer' && firebaseUser.email) {
            plainUsername = firebaseUser.email.replace(FARMER_EMAIL_DOMAIN, '');
          } else if (userRoleFromClaims === 'admin' && firebaseUser.email) {
            plainUsername = firebaseUser.email.replace(ADMIN_EMAIL_DOMAIN, '');
          } else if (userRoleFromClaims === 'operator' && firebaseUser.email) {
            plainUsername = firebaseUser.email.replace(OPERATOR_EMAIL_DOMAIN, '');
          }
          
          const authenticatedUser: AuthenticatedUser = {
            uid: firebaseUser.uid,
            username: plainUsername,
            role: userRoleFromClaims,
            isFirebaseUser: true,
          };
          setCurrentUser(authenticatedUser);
          localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
        } catch (error) {
            console.error("Error fetching ID token or claims:", error);
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            await signOut(auth); // Sign out user if claims cannot be fetched
        }
      } else {
        console.log("Firebase Auth State Changed: No user.");
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const login = async (loginDetails: {role: UserRole, username: string, password: string}) => {
    setIsLoading(true);
    const { role, username: rawUsername, password } = loginDetails;
    const username = rawUsername.trim(); 

    let emailForFirebase = "";
    if (role === 'farmer') {
      emailForFirebase = username + FARMER_EMAIL_DOMAIN;
    } else if (role === 'admin') {
      emailForFirebase = username + ADMIN_EMAIL_DOMAIN;
    } else if (role === 'operator') {
      emailForFirebase = username + OPERATOR_EMAIL_DOMAIN;
    } else {
      setIsLoading(false);
      throw new Error("Invalid role selected for login.");
    }

    try {
      console.log(`Attempting Firebase login for ${role} with pseudo-email: ${emailForFirebase}`);
      const userCredential = await signInWithEmailAndPassword(auth, emailForFirebase, password);
      const firebaseUser = userCredential.user;

      // Fetch ID token to get custom claims
      const idTokenResult = await firebaseUser.getIdTokenResult(true); // Force refresh
      const roleFromClaims = idTokenResult.claims.role as UserRole;

      if (!roleFromClaims) {
        await signOut(auth); // Sign out if no role claim
        throw new Error("User account is not configured with a role. Please contact admin.");
      }

      if (roleFromClaims !== role) {
        await signOut(auth); // Sign out if role selected in form doesn't match actual role
        throw new Error(`Role mismatch. You logged in as ${roleFromClaims}, but selected ${role}. Please use the correct role.`);
      }
      
      let plainUsername = firebaseUser.displayName || username; // Fallback to input username if displayName is not set
      if (firebaseUser.email) {
          if (role === 'farmer') plainUsername = firebaseUser.email.replace(FARMER_EMAIL_DOMAIN, '');
          else if (role === 'admin') plainUsername = firebaseUser.email.replace(ADMIN_EMAIL_DOMAIN, '');
          else if (role === 'operator') plainUsername = firebaseUser.email.replace(OPERATOR_EMAIL_DOMAIN, '');
      }


      const authenticatedUser: AuthenticatedUser = {
        uid: firebaseUser.uid,
        username: plainUsername,
        role: roleFromClaims,
        isFirebaseUser: true,
      };
      setCurrentUser(authenticatedUser);
      localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
      router.push('/dashboard');
    } catch (error: any) {
      console.error(`${role} Firebase login failed:`, error);
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      throw error; // Rethrow for LoginForm to handle
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    // CurrentUser will always be a Firebase user now, or null
    if (auth.currentUser) {
        await signOut(auth);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    router.push('/login'); // Ensure this runs after state updates
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
