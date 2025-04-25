// src/lib/firebase/auth.ts
import { auth } from './config';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, UserCredential, AuthError } from "firebase/auth";

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // This gives you a Google Access Token. You can use it to access the Google API.
    // const credential = GoogleAuthProvider.credentialFromResult(result);
    // const token = credential?.accessToken;
    // // The signed-in user info.
    // const user = result.user;
    // console.log({ credential, token, user });
    return result;
  } catch (error) {
    const authError = error as AuthError;
    console.error("Error signing in with Google:", authError.code, authError.message);
    // Handle specific errors here if needed
    // Example: handle auth/popup-closed-by-user
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};
