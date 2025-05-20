
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
  updateProfile // Added for updating Firebase Auth user profile
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
      const profileData: Partial<UserProfileData> = { // Use Partial as some fields are optional
        uid: result.user.uid,
        email: result.user.email || undefined,
        actualDisplayName: result.user.displayName || undefined,
        photoURL: result.user.photoURL || undefined,
      };
      console.log("[auth.ts] Calling initializeUserProfile for Google user with data:", profileData);
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
    if (authError.code !== 'auth/popup-closed-by-user' && authError.code !== 'auth/cancelled-popup-request') {
        console.error("[auth.ts] Error signing in with Google:", authError.code, authError.message);
    } else {
        console.log(`[auth.ts] Google sign-in process not completed by user. Code: ${authError.code}`);
    }
    if (authError.code === 'auth/api-key-not-valid') {
      console.error("[auth.ts] CRITICAL: Invalid Firebase API Key. Check .env.local and Firebase project config.");
    }
    throw authError;
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
      const profileData: Partial<UserProfileData> = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || undefined,
        companyName: additionalData?.companyName || undefined,
        industry: additionalData?.industry || undefined,
      };
      console.log("[auth.ts] signUpWithEmailPassword: Calling initializeUserProfile with:", profileData);
      await initializeUserProfile(profileData);
    }
    return userCredential;
  } catch (error) {
    const authError = error as AuthError;
    if (authError.code !== 'auth/email-already-in-use' && authError.code !== 'auth/weak-password') {
        console.error("[auth.ts] Error signing up with Email/Password:", authError.code, authError.message);
    }
    throw authError;
  }
};

// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
  console.log("[auth.ts] Attempting Email/Password Sign-In for:", email);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("[auth.ts] Email/Password Sign-In successful:", userCredential.user);
    if (userCredential.user) {
       const profileData: Partial<UserProfileData> = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || undefined,
        actualDisplayName: userCredential.user.displayName || undefined, // from Firebase Auth profile
        photoURL: userCredential.user.photoURL || undefined,       // from Firebase Auth profile
      };
      console.log("[auth.ts] signInWithEmailPassword: Calling initializeUserProfile (for potential updates like lastLoginAt) with:", profileData);
      await initializeUserProfile(profileData);
    }
    return userCredential;
  } catch (error) {
    const authError = error as AuthError;
    if (
      authError.code !== 'auth/invalid-credential' &&
      authError.code !== 'auth/user-not-found' &&
      authError.code !== 'auth/wrong-password'
    ) {
      console.error("[auth.ts] Error signing in with Email/Password:", authError.code, authError.message);
    }
    throw authError;
  }
};

// Password Reset
export const sendPasswordReset = async (email: string): Promise<void> => {
  console.log("[auth.ts] Attempting to send password reset email to:", email);
  try {
    const continueUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : 'http://localhost:9002/login';

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
    throw authError;
  }
};

// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
    console.log("[auth.ts] User signed out successfully.");
  } catch (error) {
    console.error("[auth.ts] Error signing out:", error);
    throw error;
  }
};
