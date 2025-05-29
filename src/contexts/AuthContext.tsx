
"use client";

import type { AuthenticatedUser, UserRole } from '@/types';
import { FARMER_EMAIL_DOMAIN, ADMIN_EMAIL_DOMAIN, OPERATOR_EMAIL_DOMAIN } from '@/types'; // Ensure all are imported
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
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const userRoleFromClaims = idTokenResult.claims.role as UserRole;

          if (!userRoleFromClaims) {
            console.warn("User from Firebase Auth is missing 'role' custom claim. Signing out.");
            await signOut(auth);
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            setIsLoading(false);
            return;
          }

          let plainUsername = firebaseUser.displayName || firebaseUser.uid;
          if (firebaseUser.email) {
            if (userRoleFromClaims === 'farmer' && firebaseUser.email.endsWith(FARMER_EMAIL_DOMAIN)) {
              plainUsername = firebaseUser.email.replace(FARMER_EMAIL_DOMAIN, '');
            } else if (userRoleFromClaims === 'admin' && firebaseUser.email.endsWith(ADMIN_EMAIL_DOMAIN)) {
              plainUsername = firebaseUser.email.replace(ADMIN_EMAIL_DOMAIN, '');
            } else if (userRoleFromClaims === 'operator' && firebaseUser.email.endsWith(OPERATOR_EMAIL_DOMAIN)) {
              plainUsername = firebaseUser.email.replace(OPERATOR_EMAIL_DOMAIN, '');
            } else {
              // Fallback if email doesn't match expected domain for the role, might indicate an issue
              console.warn(`User email domain does not match role claim domain. Email: ${firebaseUser.email}, Role: ${userRoleFromClaims}`);
              plainUsername = firebaseUser.email; // Or some other handling
            }
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
            console.error("Error fetching ID token or claims during onAuthStateChanged:", error);
            await signOut(auth);
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
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
    const usernameInput = rawUsername.trim();
    let emailForFirebase = "";

    const endsWithAdminDomain = usernameInput.endsWith(ADMIN_EMAIL_DOMAIN);
    const endsWithOperatorDomain = usernameInput.endsWith(OPERATOR_EMAIL_DOMAIN);
    const endsWithFarmerDomain = usernameInput.endsWith(FARMER_EMAIL_DOMAIN);

    if (role === 'admin') {
      if (endsWithAdminDomain) {
        emailForFirebase = usernameInput;
      } else if (endsWithOperatorDomain || endsWithFarmerDomain) {
        throw new Error(`Username format suggests a different role. Please select the correct role (Admin) or enter your plain username.`);
      } else {
        emailForFirebase = usernameInput + ADMIN_EMAIL_DOMAIN;
      }
    } else if (role === 'operator') {
      if (endsWithOperatorDomain) {
        emailForFirebase = usernameInput;
      } else if (endsWithAdminDomain || endsWithFarmerDomain) {
        throw new Error(`Username format suggests a different role. Please select the correct role (Operator) or enter your plain username.`);
      } else {
        emailForFirebase = usernameInput + OPERATOR_EMAIL_DOMAIN;
      }
    } else if (role === 'farmer') {
      if (endsWithFarmerDomain) {
        emailForFirebase = usernameInput;
      } else if (endsWithAdminDomain || endsWithOperatorDomain) {
        throw new Error(`Username format suggests a different role. Please select the correct role (Farmer) or enter your phone number.`);
      } else {
        // For farmers, we assume if no domain, it's a plain phone number
        emailForFirebase = usernameInput + FARMER_EMAIL_DOMAIN;
      }
    } else {
      setIsLoading(false);
      throw new Error("Invalid role selected for login.");
    }

    // Final check for multiple '@' symbols, which would make it invalid
    if (emailForFirebase.split('@').length - 1 > 1) {
        // This could happen if usernameInput was like "user@someotherdomain.com" and role was farmer,
        // leading to "user@someotherdomain.com@phone.dairyflow.com"
        // Or if usernameInput itself was "user@name" (which our settings validation should prevent for admin/op)
        throw new Error("Invalid username format. Ensure your username (if Admin/Operator) does not contain '@'. Farmers should use their phone number.");
    }


    try {
      console.log(`Attempting Firebase login for ${role} with pseudo-email: ${emailForFirebase}`);
      const userCredential = await signInWithEmailAndPassword(auth, emailForFirebase, password);
      const firebaseUser = userCredential.user;

      const idTokenResult = await firebaseUser.getIdTokenResult(true);
      const roleFromClaims = idTokenResult.claims.role as UserRole;

      if (!roleFromClaims) {
        await signOut(auth);
        throw new Error("User account is not configured with a role. Please contact admin.");
      }

      if (roleFromClaims !== role) {
        await signOut(auth);
        throw new Error(`Role mismatch. You attempted to log in as ${role}, but your account is configured as ${roleFromClaims}. Please use the correct role.`);
      }
      
      let plainUsername = firebaseUser.displayName || usernameInput; 
      if (firebaseUser.email) {
          if (role === 'farmer' && firebaseUser.email.endsWith(FARMER_EMAIL_DOMAIN)) {
            plainUsername = firebaseUser.email.replace(FARMER_EMAIL_DOMAIN, '');
          } else if (role === 'admin' && firebaseUser.email.endsWith(ADMIN_EMAIL_DOMAIN)) {
            plainUsername = firebaseUser.email.replace(ADMIN_EMAIL_DOMAIN, '');
          } else if (role === 'operator' && firebaseUser.email.endsWith(OPERATOR_EMAIL_DOMAIN)) {
            plainUsername = firebaseUser.email.replace(OPERATOR_EMAIL_DOMAIN, '');
          } else {
            plainUsername = firebaseUser.email; // Fallback
          }
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
      console.error(`${role} Firebase login failed for ${emailForFirebase}:`, error);
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      throw error; 
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    if (auth.currentUser) {
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
