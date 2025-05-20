
// src/lib/firebase/auth.ts
import { auth } from './config';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  UserCredential,
  AuthError,
  updateProfile
} from "firebase/auth";
import { initializeUserProfile } from '@/services/connectionService';
import type { UserProfileData } from '@/types/connection';

const googleProvider = new GoogleAuthProvider();

// Google Sign-In / Sign-Up
export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  console.log("[auth.ts] Attempting Google Sign-In/Sign-Up...");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[auth.ts] Google Sign-In successful, user from provider:", result.user);
    if (result.user) {
      const profileData: UserProfileData = {
        uid: result.user.uid,
        email: result.user.email || undefined, // Ensure email is passed
        actualDisplayName: result.user.displayName || undefined, // Pass Google display name
        photoURL: result.user.photoURL || undefined, // Pass Google photo URL
        // companyName and industry will be undefined here for initial Google sign-in
      };
      console.log("[auth.ts] Calling initializeUserProfile for Google user:", profileData);
      try {
        await initializeUserProfile(profileData);
        console.log("[auth.ts] User profile initialized/updated after Google sign-in.");
      } catch (profileError) {
        console.error("[auth.ts] Error initializing/updating profile after Google sign-in:", profileError);
      }
    }
    return result;
  } catch (error) {
    const authError = error as AuthError;
    // Log more specific errors, but not all.
    if (authError.code !== 'auth/popup-closed-by-user') {
        console.error("[auth.ts] Error signing in with Google:", authError.code, authError.message);
    } else {
        console.log("[auth.ts] Google sign-in popup closed by user.");
    }
    if (authError.code === 'auth/api-key-not-valid') {
      console.error("[auth.ts] CRITICAL: Invalid Firebase API Key. Check .env.local and Firebase project config.");
    }
    throw authError; // Re-throw for the calling component (e.g., login/signup page) to handle
  }
};

// Email/Password Sign-Up
export const signUpWithEmailPassword = async (
  email: string,
  password: string,
  additionalData?: { companyName?: string; industry?: string; }
): Promise<UserCredential | null> => {
  console.log("[auth.ts] Attempting Email/Password Sign-Up for:", email);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("[auth.ts] Email/Password Sign-Up successful, user from provider:", userCredential.user);

    if (userCredential.user) {
      const profileData: UserProfileData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || undefined,
        companyName: additionalData?.companyName || undefined,
        industry: additionalData?.industry || undefined,
        // actualDisplayName will be set from companyName by initializeUserProfile if not set
      };
      console.log("[auth.ts] Calling initializeUserProfile for Email/Password user:", profileData);
      try {
        await initializeUserProfile(profileData);
        console.log("[auth.ts] User profile initialized after Email/Password sign-up.");
      } catch (profileError) {
        console.error("[auth.ts] Error initializing profile after Email/Password sign-up:", profileError);
        // Decide if this should throw or just log, for now, it logs.
      }
    }
    return userCredential;
  } catch (error) {
    const authError = error as AuthError;
    // Log more specific errors, but not all.
    if (authError.code !== 'auth/email-already-in-use' && authError.code !== 'auth/weak-password') {
        console.error("[auth.ts] Error signing up with Email/Password:", authError.code, authError.message);
    }
    throw authError; // Re-throw for the calling component to handle
  }
};


// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
  console.log("[auth.ts] Attempting Email/Password Sign-In for:", email);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("[auth.ts] Email/Password Sign-In successful:", userCredential.user);
    if (userCredential.user) {
       const profileData: UserProfileData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || undefined,
        actualDisplayName: userCredential.user.displayName || undefined,
        photoURL: userCredential.user.photoURL || undefined,
      };
      console.log("[auth.ts] Calling initializeUserProfile on Email/Password login (will mostly update lastLoginAt):", profileData);
      try {
        await initializeUserProfile(profileData);
        console.log("[auth.ts] User profile checked/updated after Email/Password login.");
      } catch (profileError) {
        console.error("[auth.ts] Error checking/updating profile after Email/Password login:", profileError);
      }
    }
    return userCredential;
  } catch (error) {
    const authError = error as AuthError;
    // Only log unexpected errors to the console.
    // 'auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password' are expected if user inputs are wrong.
    if (
      authError.code !== 'auth/invalid-credential' &&
      authError.code !== 'auth/user-not-found' && // Often comes with invalid-credential
      authError.code !== 'auth/wrong-password'    // Also often comes with invalid-credential
    ) {
      console.error("[auth.ts] Error signing in with Email/Password:", authError.code, authError.message);
    }
    throw authError; // Re-throw for the calling component (login/page.tsx) to handle
  }
};


// Password Reset
export const sendPasswordReset = async (email: string): Promise<void> => {
  console.log("[auth.ts] Attempting to send password reset email to:", email);
  try {
    // Determine the continue URL based on the environment
    const continueUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/login` // Client-side: use current origin
      : process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : 'http://localhost:9002/login'; // Server-side: use env var or default

    const actionCodeSettings = {
      url: continueUrl,
      handleCodeInApp: true,
    };
    console.log("[auth.ts] Password reset actionCodeSettings:", actionCodeSettings);
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log("[auth.ts] Password reset email sent successfully to:", email);
  } catch (error) {
    const authError = error as AuthError;
    console.error("[auth.ts] Send Password Reset Error:", authError.code, authError.message);
    if (authError.code === 'auth/unauthorized-continue-uri' && typeof window !== 'undefined') {
        console.error("[auth.ts] The domain of the continue URL (" + window.location.origin + ") is not whitelisted. Please check your Firebase console's Authentication -> Settings -> Authorized domains.");
    }
    throw authError; // Re-throw for the component to handle
  }
};


// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
    console.log("[auth.ts] User signed out successfully.");
  } catch (error) {
    console.error("[auth.ts] Error signing out:", error);
    throw error; // Re-throw for the component to handle
  }
};
