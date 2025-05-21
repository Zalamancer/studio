
// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';

// Ensure this path is correct and your service account key JSON is secure
// and NOT committed to your repository if it's public.
// Best practice: Use environment variables for service account credentials.
// For example, GOOGLE_APPLICATION_CREDENTIALS environment variable.
if (!admin.apps.length) {
  try {
    // Option 1: Use GOOGLE_APPLICATION_CREDENTIALS environment variable
    // This is the recommended way for deployed environments (e.g., Cloud Functions, Cloud Run)
    // admin.initializeApp(); 
    
    // Option 2: Explicitly initialize with credentials (for local dev or specific setups)
    // Make sure to replace with your actual service account key details
    // Best to load these from environment variables as well, not hardcode.
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID, // From .env.local or server environment
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL, // From service account JSON
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // From service account JSON, handle newlines
    };

    if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin SDK initialized with explicit credentials.");
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        console.log("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS.");
    } else {
        console.warn(
            "Firebase Admin SDK not initialized. Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS environment variables."
        );
    }
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
