
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
    console.log("Google Sign-In successful:", result.user);
    return result;
  } catch (error) {
    const authError = error as AuthError;
    // Log the detailed error for debugging
    console.error("Error signing in with Google (auth.ts):", authError.code, authError.message);
    // Re-throw the error so the calling component can handle specific cases and show user-friendly messages
    throw authError;
  }
};

// Email/Password Sign-Up
export const signUpWithEmailPassword = async (email: string, password: string): Promise<UserCredential | null> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Could add logic here to store additional user info (like companyName) in Firestore
        console.log("Email/Password Sign-Up successful:", userCredential.user);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
        console.error("Error signing up with Email/Password (auth.ts):", authError.code, authError.message);
        throw authError; // Re-throw for component handling
    }
};

// Email/Password Sign-In
export const signInWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Email/Password Sign-In successful:", userCredential.user);
        return userCredential;
    } catch (error) {
        const authError = error as AuthError;
         console.error("Error signing in with Email/Password (auth.ts):", authError.code, authError.message);
        // Add more specific error handling if needed, but re-throwing is generally good
        throw authError; // Re-throw for component handling
    }
};

// Password Reset
export const sendPasswordReset = async (email: string): Promise<void> => {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log("Password reset email sent successfully to:", email);
        // Email sent successfully (or user not found, Firebase doesn't reveal this)
    } catch (error) {
        const authError = error as AuthError;
         console.error("Error sending password reset email (auth.ts):", authError.code, authError.message);
        // Re-throw specific errors for the component to handle
        throw authError;
    }
};


// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
     console.log("User signed out successfully.");
  } catch (error) {
    console.error("Error signing out (auth.ts):", error);
     throw error; // Re-throw for component handling if needed
  }
};


    