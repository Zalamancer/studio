
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
  updateProfile // Import updateProfile if you want to set displayName in Auth
} from "firebase/auth";
import { initializeUserProfile } from '@/services/connectionService'; // Import user profile function
import type { UserProfileData } from '@/types/connection'; // Import UserProfileData type

const googleProvider = new GoogleAuthProvider();

// Google Sign-In / Sign-Up
export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[auth.ts] Google Sign-In successful, user:", result.user);
    if (result.user) {
      // Prepare data for profile initialization/update
      const profileData: UserProfileData = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || '', // Google usually provides displayName
        photoURL: result.user.photoURL || undefined,
        // companyName and industry are not directly available from Google Sign-In
      };
      console.log("[auth.ts] Calling initializeUserProfile for Google user:", profileData);
      try {
        await initializeUserProfile(profileData);
        console.log("[auth.ts] User profile initialized/updated after Google sign-in.");
      } catch (profileError) {
        console.error("[auth.ts] Error initializing/updating profile after Google sign-in:", profileError);
        // Decide if this error should prevent login or just be logged
        // For now, just log it. The user is authenticated.
      }
    }
    return result;
  } catch (error) {
    const authError = error as AuthError;
    console.error("[auth.ts] Error signing in with Google:", authError.code, authError.message);
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
      // Optionally update Firebase Auth profile displayName immediately
      // This helps if initializeUserProfile takes time or if some parts of the app read from auth.currentUser.displayName directly
      if (additionalData?.companyName) {
        try {
          await updateProfile(userCredential.user, { displayName: additionalData.companyName });
          console.log("[auth.ts] Firebase Auth profile displayName updated to companyName:", additionalData.companyName);
        } catch (updateProfileError) {
          console.error("[auth.ts] Error updating Firebase Auth profile displayName:", updateProfileError);
        }
      }

      const profileData: UserProfileData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName: additionalData?.companyName || '', // Use companyName as displayName for email signups
        companyName: additionalData?.companyName || undefined,
        industry: additionalData?.industry || undefined,
        photoURL: undefined, // No photoURL from email/password sign-up by default
      };
      console.log("[auth.ts] Calling initializeUserProfile for Email/Password user:", profileData);
      try {
        await initializeUserProfile(profileData);
        console.log("[auth.ts] User profile initialized after Email/Password sign-up.");
      } catch (profileError) {
        console.error("[auth.ts] Error initializing profile after Email/Password sign-up:", profileError);
        // Decide if this error should prevent login or just be logged
        // If profile creation is critical, you might want to delete the auth user here and re-throw
        // For now, just log it. The user is authenticated.
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
    // Optionally, update lastLoginAt in user profile here if needed (already in initializeUserProfile)
    if (userCredential.user) {
       const profileData: UserProfileData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName: userCredential.user.displayName || '',
        photoURL: userCredential.user.photoURL || undefined,
      };
      // We call initializeUserProfile on login too, to ensure profile exists or lastLogin is updated
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
      url: `${window.location.origin}/login`, // URL to redirect back to after password reset
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log("[auth.ts] Password reset email sent successfully to:", email);
  } catch (error) {
    const authError = error as AuthError;
    console.error("[auth.ts] Send Password Reset Error:", authError.code, authError.message);
    if (authError.code === 'auth/unauthorized-continue-uri') {
        console.error("[auth.ts] The domain of the continue URL is not whitelisted. Please check your Firebase console's Authentication -> Settings -> Authorized domains.");
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
