
// src/lib/firebase/auth.ts
import { auth } from './config';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword, // Import for signup
  signInWithEmailAndPassword,    // Import for email login
  UserCredential,
  AuthError
} from "firebase/auth";

const googleProvider = new GoogleAuthProvider();

// Google Sign-In
export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    const authError = error as AuthError;
    // Avoid console.error for expected errors like popup closed
    if (authError.code !== 'auth/popup-closed-by-user') {
      console.error("Error signing in with Google:", authError.code, authError.message);
    }
    return null;
  }
};

// Email/Password Sign-Up
export const signUpWithEmailPassword = async (email: string, password: string): Promise<UserCredential | null> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        console.error("Error signing up with email/password:", authError.code, authError.message);
        // Re-throw the error so the calling component can handle it specifically (e.g., show specific toast messages)
        throw authError;
    }
};

// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential | null> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        // Don't log expected errors like 'user-not-found' or 'wrong-password' to console by default
        if (authError.code !== 'auth/user-not-found' && authError.code !== 'auth/invalid-credential' && authError.code !== 'auth/wrong-password') {
             console.error("Error signing in with email/password:", authError.code, authError.message);
        }
        // Re-throw the error so the calling component can handle it specifically
        throw authError;
    }
};


// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};
