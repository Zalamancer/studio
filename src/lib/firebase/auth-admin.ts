
// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  console.log("[auth-admin.ts] Attempting to initialize Firebase Admin SDK...");
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // If GOOGLE_APPLICATION_CREDENTIALS is set, initializeApp() will use it automatically.
      admin.initializeApp();
      console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully using GOOGLE_APPLICATION_CREDENTIALS environment variable.", "color: green; font-weight: bold;");
    } else {
      console.warn(
        `%c[auth-admin.ts] GOOGLE_APPLICATION_CREDENTIALS environment variable is NOT SET. Firebase Admin SDK relies on this for default initialization in many environments. Please set it to the path of your service account key JSON file.`, "color: orange; font-weight: bold;"
      );
      // Commenting out the explicit credential fallback to strictly test GOOGLE_APPLICATION_CREDENTIALS
      /*
      console.log("[auth-admin.ts] GOOGLE_APPLICATION_CREDENTIALS not set. Attempting to initialize Firebase Admin SDK with explicit credentials from other environment variables (FIREBASE_PROJECT_ID, etc.).");
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKeyFromEnv = process.env.FIREBASE_PRIVATE_KEY;
      
      console.log("[auth-admin.ts] Raw FIREBASE_PRIVATE_KEY from .env.local (first 100 chars):", privateKeyFromEnv ? privateKeyFromEnv.substring(0,100) + "..." : "NOT SET");
      const privateKey = privateKeyFromEnv?.replace(/\\n/g, '\n');
      let finalProcessedPrivateKey = privateKey;
      if (finalProcessedPrivateKey && !finalProcessedPrivateKey.endsWith('\n')) {
          console.log("[auth-admin.ts] Adding missing newline to end of processed private key.");
          finalProcessedPrivateKey += '\n';
      }
      console.log("[auth-admin.ts] Processed FIREBASE_PRIVATE_KEY after replace (first 100 chars):", finalProcessedPrivateKey ? finalProcessedPrivateKey.substring(0,100) + "..." : "NOT SET or EMPTY after processing");


      let missingVars = [];
      if (!projectId) missingVars.push("FIREBASE_PROJECT_ID");
      if (!clientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL");
      if (!privateKeyFromEnv) missingVars.push("FIREBASE_PRIVATE_KEY (from env)");
      if (!finalProcessedPrivateKey) missingVars.push("FIREBASE_PRIVATE_KEY (processed, likely empty or whitespace)");

      if (missingVars.length > 0) {
        console.warn(
          `%c[auth-admin.ts] Firebase Admin SDK NOT initialized. Missing explicit environment variables: ${missingVars.join(', ')}. Also, GOOGLE_APPLICATION_CREDENTIALS was not set.`, "color: orange; font-weight: bold;"
        );
      } else {
        console.log("[auth-admin.ts] Explicit credentials being used (project, email, private key snippet):", {
            projectId,
            clientEmail,
            privateKeySnippet: finalProcessedPrivateKey ? finalProcessedPrivateKey.substring(0, 50) + "..." + finalProcessedPrivateKey.substring(finalProcessedPrivateKey.length - 50) : "NOT AVAILABLE",
        });
        console.log("[auth-admin.ts] DEBUG: Full processed private key being passed to admin.credential.cert():");
        console.log("```");
        console.log(finalProcessedPrivateKey);
        console.log("```");
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: finalProcessedPrivateKey,
          }),
        });
        console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully with explicit credentials from environment variables.", "color: green; font-weight: bold;");
      }
      */
      // If GOOGLE_APPLICATION_CREDENTIALS is not set, and we've commented out the fallback,
      // initializeApp() called without args later will fail if run in an environment without default credentials.
      // For local dev without GOOGLE_APPLICATION_CREDENTIALS, you might need to uncomment the explicit block
      // OR ensure your terminal session running `npm run dev` HAS GOOGLE_APPLICATION_CREDENTIALS set.
      // Throwing an error here to make it clear if neither method is available.
      throw new Error("Firebase Admin SDK could not be initialized. GOOGLE_APPLICATION_CREDENTIALS not set, and explicit credential fallback is commented out.");
    }
  } catch (error: any) {
    console.error('%c[auth-admin.ts] Firebase Admin SDK initialization error:', "color: red; font-weight: bold;", error.message);
    console.error("[auth-admin.ts] Stack trace for initialization error:", error.stack);
  }
} else {
    console.log("[auth-admin.ts] Firebase Admin SDK already initialized.");
}

// console.log("[auth-admin.ts] Ensure your service account credentials (either via GOOGLE_APPLICATION_CREDENTIALS or individual FIREBASE_... variables) are correctly configured and accessible in your server environment.");

export const authAdmin = admin.apps.length ? admin.auth() : null;
export const dbAdmin = admin.apps.length ? admin.firestore() : null;

// Logging initialization status for clarity
if (process.env.NODE_ENV !== 'production') { // Only log extensively in dev
    if (admin.apps.length === 0) {
        console.error("[auth-admin.ts] CRITICAL: Firebase Admin SDK has NO initialized apps. This means initialization failed earlier.");
    }
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
