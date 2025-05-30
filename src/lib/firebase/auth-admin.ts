// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  console.log("[auth-admin.ts] Attempting to initialize Firebase Admin SDK...");
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully using GOOGLE_APPLICATION_CREDENTIALS environment variable.", "color: green; font-weight: bold;");
    } else {
      console.log("[auth-admin.ts] GOOGLE_APPLICATION_CREDENTIALS not set. Attempting to initialize Firebase Admin SDK with explicit credentials from other environment variables (FIREBASE_PROJECT_ID, etc.).");
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Important: Replace \\n with actual newlines

      let missingVars = [];
      if (!projectId) missingVars.push("FIREBASE_PROJECT_ID");
      if (!clientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL");
      if (!privateKey) missingVars.push("FIREBASE_PRIVATE_KEY");

      if (missingVars.length > 0) {
        console.warn(
          `%c[auth-admin.ts] Firebase Admin SDK NOT initialized. Missing explicit environment variables: ${missingVars.join(', ')}. Also, GOOGLE_APPLICATION_CREDENTIALS was not set. Server-side features requiring admin privileges will fail.`, "color: orange; font-weight: bold;"
        );
        console.warn("[auth-admin.ts] Please ensure your .env.local (for local dev) or server environment has these variables correctly set if not using GOOGLE_APPLICATION_CREDENTIALS.");
      } else {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: privateKey,
          }),
        });
        console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully with explicit credentials from environment variables.", "color: green; font-weight: bold;");
      }
    }
  } catch (error: any) {
    console.error('%c[auth-admin.ts] Firebase Admin SDK initialization error:', "color: red; font-weight: bold;", error.message);
    console.error("[auth-admin.ts] Stack trace for initialization error:", error.stack);
    console.error("[auth-admin.ts] Ensure your service account credentials (either via GOOGLE_APPLICATION_CREDENTIALS or individual FIREBASE_... variables) are correctly configured and accessible in your server environment.");
  }
} else {
    console.log("[auth-admin.ts] Firebase Admin SDK already initialized.");
}

// Export admin instances. They will be null if initialization failed.
// Code relying on these MUST check if they are null before using.
export const authAdmin = admin.apps.length ? admin.auth() : null;
export const dbAdmin = admin.apps.length ? admin.firestore() : null;

if (process.env.NODE_ENV !== 'production') { // Log status only in dev
    if (!authAdmin) {
        console.error("[auth-admin.ts] CRITICAL: authAdmin (Firebase Admin Auth) is NULL after initialization attempt. API routes requiring admin auth will fail.");
    } else {
        console.log("[auth-admin.ts] authAdmin (Firebase Admin Auth) is INITIALIZED.");
    }
    if (!dbAdmin) {
        console.error("[auth-admin.ts] CRITICAL: dbAdmin (Firebase Admin Firestore) is NULL after initialization attempt. API routes requiring admin Firestore access will fail.");
    } else {
        console.log("[auth-admin.ts] dbAdmin (Firebase Admin Firestore) is INITIALIZED.");
    }
}
