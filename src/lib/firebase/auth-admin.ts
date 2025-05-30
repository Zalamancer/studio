
// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';

// Path to your service account key JSON file, relative to this file's location
// Assuming serviceAccountKey.json is at the project root
// and this file (auth-admin.ts) is at src/lib/firebase/auth-admin.ts
const SERVICE_ACCOUNT_KEY_PATH = '../../../serviceAccountKey.json';

if (!admin.apps.length) {
  console.log("[auth-admin.ts] Attempting to initialize Firebase Admin SDK using local service account key...");
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully using local serviceAccountKey.json.", "color: green; font-weight: bold;");
  } catch (error: any) {
    console.error('%c[auth-admin.ts] Firebase Admin SDK initialization error using local key:', "color: red; font-weight: bold;", error.message);
    console.error("[auth-admin.ts] Stack trace for initialization error:", error.stack);
    console.error(`[auth-admin.ts] Ensure 'serviceAccountKey.json' exists at the project root and the path '${SERVICE_ACCOUNT_KEY_PATH}' is correct relative to 'src/lib/firebase/auth-admin.ts'. Also, ensure the key file is added to .gitignore.`);
  }
} else {
    console.log("[auth-admin.ts] Firebase Admin SDK already initialized.");
}

export const authAdmin = admin.apps.length ? admin.auth() : null;
export const dbAdmin = admin.apps.length ? admin.firestore() : null;

// Logging initialization status for clarity
if (process.env.NODE_ENV !== 'production') { // Only log extensively in dev
    if (admin.apps.length === 0) {
        console.error("[auth-admin.ts] CRITICAL: Firebase Admin SDK has NO initialized apps after attempt. This means initialization failed earlier or was skipped.");
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
