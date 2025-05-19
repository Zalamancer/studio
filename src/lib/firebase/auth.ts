
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
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[auth.ts] Google Sign-In successful, user:", result.user);
    if (result.user) {
      // Prepare data for profile initialization/update
      // Do NOT pass result.user.displayName here to ensure generated name is used by default.
      // CompanyName and Industry will be collected later for Google users.
      const profileData: UserProfileData = {
        uid: result.user.uid,
        email: result.user.email || '',
        // displayName: '', // Intentionally omit or pass empty to let initializeUserProfile generate one
        photoURL: result.user.photoURL || undefined,
        // companyName and industry will be undefined here for initial Google sign-in
      };
      console.log("[auth.ts] Calling initializeUserProfile for Google user (expecting generated name):", profileData);
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
    console.error("[auth.ts] Error signing in with Google:", authError.code, authError.message);
    if (authError.code === 'auth/popup-closed-by-user') {
      // User closed the popup, not necessarily an "error" to show a destructive toast for.
      // The component calling this might handle this by doing nothing.
      console.log("[auth.ts] Google sign-in popup closed by user.");
    } else if (authError.code === 'auth/account-exists-with-different-credential') {
      console.error("[auth.ts] Google sign-in: Account exists with different credential for this email.");
    } else if (authError.code === 'auth/api-key-not-valid') {
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
  console.log("[auth.ts] Attempting Email/Password Sign-Up for:", email, "with additionalData:", additionalData);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("[auth.ts] Email/Password Sign-Up successful, user:", userCredential.user);

    if (userCredential.user) {
      // For email/password, companyName becomes the initial displayName if provided
      const initialDisplayName = additionalData?.companyName || ''; 
      
      // Update Firebase Auth profile displayName immediately if companyName is available
      if (initialDisplayName) {
        try {
          await updateProfile(userCredential.user, { displayName: initialDisplayName });
          console.log("[auth.ts] Firebase Auth profile displayName updated to companyName:", initialDisplayName);
        } catch (updateProfileError) {
          console.error("[auth.ts] Error updating Firebase Auth profile displayName:", updateProfileError);
        }
      }

      const profileData: UserProfileData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName: initialDisplayName, // Pass companyName as displayName here
        companyName: additionalData?.companyName || undefined,
        industry: additionalData?.industry || undefined,
        photoURL: undefined,
      };
      console.log("[auth.ts] Calling initializeUserProfile for Email/Password user:", profileData);
      try {
        await initializeUserProfile(profileData);
        console.log("[auth.ts] User profile initialized after Email/Password sign-up.");
      } catch (profileError) {
        console.error("[auth.ts] Error initializing profile after Email/Password sign-up:", profileError);
      }
    }
    return userCredential;
  } catch (error) {
    const authError = error as AuthError;
    console.error("[auth.ts] Error signing up with Email/Password:", authError.code, authError.message);
    throw authError;
  }
};

// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("[auth.ts] Email/Password Sign-In successful:", userCredential.user);
    if (userCredential.user) {
       const profileData: UserProfileData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName: userCredential.user.displayName || '', // Use existing auth displayName
        photoURL: userCredential.user.photoURL || undefined,
      };
      console.log("[auth.ts] Calling initializeUserProfile on Email/Password login:", profileData);
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
    console.error("[auth.ts] Error signing in with Email/Password:", authError.code, authError.message);
    throw authError;
  }
};

// Password Reset
export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    const actionCodeSettings = {
      url: typeof window !== 'undefined' ? `${window.location.origin}/login` : 'http://localhost:9002/login', // Fallback for server-side if needed
      handleCodeInApp: true,
    };
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
