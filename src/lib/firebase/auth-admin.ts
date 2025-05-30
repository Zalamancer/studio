// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_KEY_FILENAME = 'serviceAccountKey.json';
let authAdmin: admin.auth.Auth | null = null;
let dbAdmin: admin.firestore.Firestore | null = null;

if (!admin.apps.length) {
  console.log("[auth-admin.ts] Attempting to initialize Firebase Admin SDK...");
  try {
    // Construct the absolute path to the service account key file
    // process.cwd() usually points to the project root in Next.js
    const keyPath = path.resolve(process.cwd(), SERVICE_ACCOUNT_KEY_FILENAME);
    console.log(`[auth-admin.ts] Looking for service account key at: ${keyPath}`);

    if (fs.existsSync(keyPath)) {
      console.log(`[auth-admin.ts] Found service account key file: ${keyPath}`);
      const serviceAccountJSON = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountJSON);

      console.log("[auth-admin.ts] Service account JSON parsed. Initializing app with cert...");
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      authAdmin = admin.auth();
      dbAdmin = admin.firestore();
      console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully using local serviceAccountKey.json via fs.readFileSync.", "color: green; font-weight: bold;");
    } else {
      console.error(`%c[auth-admin.ts] CRITICAL ERROR: Service account key file NOT FOUND at: ${keyPath}. Firebase Admin SDK cannot be initialized.`, "color: red; font-weight: bold;");
      console.error(`[auth-admin.ts] Please ensure '${SERVICE_ACCOUNT_KEY_FILENAME}' is in the project root directory.`);
    }
  } catch (error: any) {
    console.error('%c[auth-admin.ts] Firebase Admin SDK initialization error (using fs.readFileSync):', "color: red; font-weight: bold;", error.message);
    console.error("[auth-admin.ts] Stack trace for initialization error:", error.stack);
    if (error.message.includes("ENOENT")) {
        console.error(`[auth-admin.ts] This likely means the file '${SERVICE_ACCOUNT_KEY_FILENAME}' was not found at the project root.`);
    } else if (error.message.includes("SyntaxError")) {
        console.error(`[auth-admin.ts] This likely means the content of '${SERVICE_ACCOUNT_KEY_FILENAME}' is not valid JSON.`);
    } else if (error.message.includes("Failed to parse private key") || error.message.includes("Invalid PEM")) {
        console.error(`[auth-admin.ts] The private_key within your service account JSON seems to be malformed or corrupted.`);
    }
  }
} else {
  console.log("[auth-admin.ts] Firebase Admin SDK already initialized. Re-assigning authAdmin and dbAdmin.");
  // Ensure authAdmin and dbAdmin are assigned even if already initialized
  if (admin.apps[0]) {
    authAdmin = admin.apps[0]!.auth();
    dbAdmin = admin.apps[0]!.firestore();
  }
}

// Final check and logging for status
if (admin.apps.length === 0) {
    console.error("[auth-admin.ts] CRITICAL: Firebase Admin SDK has NO initialized apps after attempt. Initialization failed.");
}
if (!authAdmin) {
    console.error("[auth-admin.ts] CRITICAL: authAdmin (Firebase Admin Auth) is NULL. API routes requiring admin auth will fail.");
} else if (admin.apps.length > 0) {
    console.log("[auth-admin.ts] authAdmin (Firebase Admin Auth) is INITIALIZED and available.");
}
if (!dbAdmin) {
    console.error("[auth-admin.ts] CRITICAL: dbAdmin (Firebase Admin Firestore) is NULL. API routes requiring admin Firestore access will fail.");
} else if (admin.apps.length > 0) {
    console.log("[auth-admin.ts] dbAdmin (Firebase Admin Firestore) is INITIALIZED and available.");
}

export { authAdmin, dbAdmin };
