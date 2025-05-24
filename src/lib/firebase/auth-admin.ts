// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      console.log("[auth-admin.ts] Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS.");
    } else {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

      if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("[auth-admin.ts] Firebase Admin SDK initialized with explicit credentials from environment variables.");
      } else {
        console.warn(
          "[auth-admin.ts] Firebase Admin SDK NOT initialized. Missing explicit credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) AND GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. Some backend features might not work."
        );
      }
    }
  } catch (error: any) {
    console.error('[auth-admin.ts] Firebase Admin SDK initialization error:', error.stack);
  }
}

// Export admin instances, they will be null if initialization failed but code relying on them should check.
export const authAdmin = admin.apps.length ? admin.auth() : null;
export const dbAdmin = admin.apps.length ? admin.firestore() : null;