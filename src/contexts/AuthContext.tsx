
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
  login: (loginDetails: {role: UserRole, username: string, password: string}) => Promise<{success: boolean, error?: any}>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(firebaseApp);

console.log("AuthContext.tsx: Script loaded. Explicitly client component."); // Top-level log

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  console.log("AuthProvider: Rendering");

  useEffect(() => {
    console.log("AuthProvider useEffect: Setting up onAuthStateChanged listener");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true);
      console.log("AuthProvider onAuthStateChanged: Fired. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          console.log("AuthProvider onAuthStateChanged: ID token result obtained. Claims:", idTokenResult.claims);
          const userRoleFromClaims = idTokenResult.claims.role as UserRole;

          if (!userRoleFromClaims) {
            console.warn("AuthProvider onAuthStateChanged: User is missing 'role' custom claim. UID:", firebaseUser.uid, "Signing out.");
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
              console.warn(`AuthProvider onAuthStateChanged: User email domain does not match role claim domain. Email: ${firebaseUser.email}, Role: ${userRoleFromClaims}`);
              plainUsername = firebaseUser.email; 
            }
          }
          
          const authenticatedUser: AuthenticatedUser = {
            uid: firebaseUser.uid,
            username: plainUsername,
            role: userRoleFromClaims,
            isFirebaseUser: true,
          };
          console.log("AuthProvider onAuthStateChanged: Setting current user:", authenticatedUser);
          setCurrentUser(authenticatedUser);
          localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
        } catch (error) {
            console.error("AuthProvider onAuthStateChanged: Error fetching ID token or claims. UID:", firebaseUser.uid, "Error:", error);
            await signOut(auth);
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
        }
      } else {
        console.log("AuthProvider onAuthStateChanged: No Firebase user. Clearing current user.");
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
      }
      console.log("AuthProvider onAuthStateChanged: Setting isLoading to false.");
      setIsLoading(false);
    });
    return () => {
      console.log("AuthProvider useEffect: Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    };
  }, [router]);


  const login = async (loginDetails: {role: UserRole, username: string, password: string}): Promise<{success: boolean, error?: any}> => {
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
        setIsLoading(false);
        return { success: false, error: { message: `Username format suggests a different role. Please select the correct role (Admin) or enter your plain username.`}};
      } else {
        emailForFirebase = usernameInput + ADMIN_EMAIL_DOMAIN;
      }
    } else if (role === 'operator') {
      if (endsWithOperatorDomain) {
        emailForFirebase = usernameInput;
      } else if (endsWithAdminDomain || endsWithFarmerDomain) {
         setIsLoading(false);
        return { success: false, error: { message: `Username format suggests a different role. Please select the correct role (Operator) or enter your plain username.`}};
      } else {
        emailForFirebase = usernameInput + OPERATOR_EMAIL_DOMAIN;
      }
    } else if (role === 'farmer') {
      if (endsWithFarmerDomain) {
        emailForFirebase = usernameInput;
      } else if (endsWithAdminDomain || endsWithOperatorDomain) {
         setIsLoading(false);
        return { success: false, error: { message: `Username format suggests a different role. Please select the correct role (Farmer) or enter your phone number.`}};
      } else {
        emailForFirebase = usernameInput + FARMER_EMAIL_DOMAIN;
      }
    } else {
      setIsLoading(false);
      return { success: false, error: { message: "Invalid role selected for login." }};
    }

    if (emailForFirebase.split('@').length - 1 > 1) {
        setIsLoading(false);
        return { success: false, error: { message: "Invalid username format. Ensure your username (if Admin/Operator) does not contain '@'. Farmers should use their phone number."}};
    }

    try {
      console.log(`AuthProvider login: Attempting with pseudo-email: "${emailForFirebase}", Role: "${role}", Password: "${password}"`); // Temporary: For debugging invalid credential issue
      const userCredential = await signInWithEmailAndPassword(auth, emailForFirebase, password);
      const firebaseUser = userCredential.user;

      const idTokenResult = await firebaseUser.getIdTokenResult(true);
      const roleFromClaims = idTokenResult.claims.role as UserRole;
      console.log(`AuthProvider login: Role from claims for ${emailForFirebase}: ${roleFromClaims}`);

      if (!roleFromClaims) {
        await signOut(auth);
        setIsLoading(false);
        return { success: false, error: { message: "User account is not configured with a role. Please contact admin." }};
      }

      if (roleFromClaims !== role) {
        await signOut(auth);
        setIsLoading(false);
        return { success: false, error: { message: `Role mismatch. You attempted to log in as ${role}, but your account is ${roleFromClaims}. Please use the correct role.` }};
      }
      
      console.log(`AuthProvider login: Login successful for ${emailForFirebase}.`);
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      console.error(`AuthProvider login: Firebase login failed for "${emailForFirebase}". Role: "${role}". Error code: ${error.code}, Message: ${error.message}`, error);
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      setIsLoading(false);
      return { success: false, error: error };
    }
  };

  const logout = async () => {
    console.log("AuthProvider logout: Initiated.");
    setIsLoading(true);
    if (auth.currentUser) {
        console.log("AuthProvider logout: Firebase user exists, signing out from Firebase.");
        await signOut(auth);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    console.log("AuthProvider logout: Cleared current user and localStorage. Pushing to /login.");
    router.push('/login');
    setIsLoading(false);
    console.log("AuthProvider logout: Completed.");
  };
  
  console.log("AuthProvider: Providing context value. isLoading:", isLoading, "currentUser:", currentUser ? currentUser.uid : 'null');

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  console.log("useAuth: Hook called");
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error("useAuth: Error - context is undefined. AuthProvider might not be wrapping the component.");
    throw new Error('useAuth must be used within an AuthProvider');
  }
  console.log("useAuth: Context value received:", context.currentUser ? {isLoading: context.isLoading, uid: context.currentUser.uid, role: context.currentUser.role } : {isLoading: context.isLoading, currentUser: undefined});
  return context;
};
