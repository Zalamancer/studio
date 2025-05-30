// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // GOOGLE_APPLICATION_CREDENTIALS is set, typically in deployed environments (e.g., Google Cloud Functions, Cloud Run)
      // or if you've manually set it locally pointing to your service account JSON file.
      admin.initializeApp();
      console.log("[auth-admin.ts] Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS environment variable.");
    } else {
      // Attempt to initialize with explicit credentials from other environment variables
      // This is more common for local development if GOOGLE_APPLICATION_CREDENTIALS isn't set.
      console.log("[auth-admin.ts] GOOGLE_APPLICATION_CREDENTIALS not set. Attempting to initialize Firebase Admin SDK with explicit credentials from other environment variables (FIREBASE_PROJECT_ID, etc.).");
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      let missingVars = [];
      if (!projectId) missingVars.push("FIREBASE_PROJECT_ID");
      if (!clientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL");
      if (!privateKey) missingVars.push("FIREBASE_PRIVATE_KEY");

      if (missingVars.length > 0) {
        console.warn(
          `[auth-admin.ts] Firebase Admin SDK NOT initialized due to missing explicit environment variables: ${missingVars.join(', ')}. Also, GOOGLE_APPLICATION_CREDENTIALS was not set. Some backend features might not work.`
        );
      } else {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: privateKey,
          }),
        });
        console.log("[auth-admin.ts] Firebase Admin SDK initialized successfully with explicit credentials from environment variables.");
      }
    }
  } catch (error: any) {
    console.error('[auth-admin.ts] Firebase Admin SDK initialization error:', error.stack);
    // Log the error but don't re-throw, let the null check handle it later.
  }
} else {
    console.log("[auth-admin.ts] Firebase Admin SDK already initialized.");
}

// Export admin instances. They will be null if initialization failed.
// Code relying on these MUST check if they are null before using.
export const authAdmin = admin.apps.length ? admin.auth() : null;
export const dbAdmin = admin.apps.length ? admin.firestore() : null;

if (!authAdmin) {
    console.error("[auth-admin.ts] CRITICAL: authAdmin (Firebase Admin Auth) is NULL after initialization attempt. API routes requiring admin auth will fail.");
}
if (!dbAdmin) {
    console.error("[auth-admin.ts] CRITICAL: dbAdmin (Firebase Admin Firestore) is NULL after initialization attempt. API routes requiring admin Firestore access will fail.");
}
