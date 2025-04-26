
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
    // Re-throw the error so the calling component can handle specific cases like popup closed
    throw authError;
  }
};

// Email/Password Sign-Up
export const signUpWithEmailPassword = async (email: string, password: string): Promise<UserCredential | null> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        // Log unexpected errors, but re-throw all for component handling
        if (authError.code !== 'auth/email-already-in-use' && authError.code !== 'auth/weak-password' && authError.code !== 'auth/invalid-email') {
            console.error("Error signing up with email/password:", authError.code, authError.message);
        }
        // Re-throw the error so the calling component can handle it specifically (e.g., show specific toast messages)
        throw authError;
    }
};

// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        // Don't log expected errors like 'auth/invalid-credential' to console here.
        // The calling component (login page) will handle the user feedback (toast)
        // and can decide whether to log based on the specific code.
        // Re-throw the error so the calling component can handle it specifically.
        throw authError;
    }
};


// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
     // Optionally re-throw or handle differently if needed
     throw error;
  }
};
