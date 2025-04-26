
// src/lib/firebase/auth.ts
import { auth } from './config';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail, // Import for password reset
  UserCredential,
  AuthError
} from "firebase/auth";

const googleProvider = new GoogleAuthProvider();

// Google Sign-In / Sign-Up
export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Could add logic here to check if user is new and add to Firestore if needed
    return result;
  } catch (error) {
    const authError = error as AuthError;
    // Re-throw the error so the calling component can handle specific cases
    throw authError;
  }
};

// Email/Password Sign-Up
export const signUpWithEmailPassword = async (email: string, password: string): Promise<UserCredential | null> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Could add logic here to store additional user info (like companyName) in Firestore
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        throw authError; // Re-throw for component handling
    }
};

// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        throw authError; // Re-throw for component handling
    }
};

// Password Reset
export const sendPasswordReset = async (email: string): Promise<void> => {
    try {
        await sendPasswordResetEmail(auth, email);
        // Email sent successfully (or user not found, Firebase doesn't reveal this)
    } catch (error) {
        const authError = error as AuthError;
        // Re-throw specific errors for the component to handle
        throw authError;
    }
};


// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
     throw error; // Re-throw for component handling if needed
  }
};
