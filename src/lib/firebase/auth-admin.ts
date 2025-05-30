// src/lib/firebase/auth-admin.ts
// This file is for server-side (Admin SDK) Firebase operations.
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_KEY_FILENAME = 'serviceAccountKey.json';
let authAdmin: admin.auth.Auth | null = null;
let dbAdmin: admin.firestore.Firestore | null = null;

console.log("[auth-admin.ts] Module loaded. Attempting to initialize Firebase Admin SDK...");

if (!admin.apps.length) {
  try {
    console.log("[auth-admin.ts] Initializing Firebase Admin SDK using local service account key from project root...");
    const keyPath = path.resolve(process.cwd(), SERVICE_ACCOUNT_KEY_FILENAME);
    console.log(`[auth-admin.ts] Looking for service account key at: ${keyPath}`);

    if (fs.existsSync(keyPath)) {
      console.log(`[auth-admin.ts] Found service account key file: ${keyPath}`);
      const serviceAccountJSON = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountJSON);
      console.log("[auth-admin.ts] Service account JSON parsed successfully.");
      console.log(`[auth-admin.ts] Parsed credentials - Project ID: ${serviceAccount.project_id}, Client Email: ${serviceAccount.client_email}`);
      console.log(`[auth-admin.ts] Parsed credentials - Private Key Snippet (first 30 chars): ${serviceAccount.private_key?.substring(0, 30)}...`);

      // Log the entire private key FOR DEBUGGING ONLY - REMOVE AFTER DEBUGGING
      // Be extremely careful with this log in any shared environment.
      // console.log("[auth-admin.ts] DEBUG: Full private key from parsed JSON (first 100 chars for verification):", serviceAccount.private_key?.substring(0, 100));

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      authAdmin = admin.auth();
      dbAdmin = admin.firestore();
      console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully using local serviceAccountKey.json via fs.readFileSync.", "color: green; font-weight: bold;");
    } else {
      console.error(`%c[auth-admin.ts] CRITICAL ERROR: Service account key file NOT FOUND at: ${keyPath}. Firebase Admin SDK cannot be initialized.`, "color: red; font-weight: bold;");
      console.error(`[auth-admin.ts] Please ensure '${SERVICE_ACCOUNT_KEY_FILENAME}' is in the project root directory and is included in your deployment if necessary (but also add to .gitignore!).`);
    }
  } catch (error: any) {
    console.error('%c[auth-admin.ts] Firebase Admin SDK initialization error (using fs.readFileSync):', "color: red; font-weight: bold;", error.message);
    console.error("[auth-admin.ts] Stack trace for initialization error:", error.stack);
    if (error.message && error.message.includes("ENOENT")) {
        console.error(`[auth-admin.ts] This likely means the file '${SERVICE_ACCOUNT_KEY_FILENAME}' was not found at the project root.`);
    } else if (error.message && error.message.includes("SyntaxError") && error.message.includes("JSON")) {
        console.error(`[auth-admin.ts] This likely means the content of '${SERVICE_ACCOUNT_KEY_FILENAME}' is not valid JSON.`);
    } else if (error.message && (error.message.includes("Failed to parse private key") || error.message.includes("Invalid PEM"))) {
        console.error(`[auth-admin.ts] The private_key within your service account JSON seems to be malformed or corrupted. Verify the key content and format, especially newlines.`);
    } else if (error.message && error.message.includes("INTERNAL")) {
        console.error(`[auth-admin.ts] Received 'INTERNAL' error from firebase-admin. This often points to an issue with the 'firebase-admin' package itself in node_modules or a deep issue with the credentials not caught by earlier checks. Consider deleting node_modules and package-lock.json/yarn.lock, then reinstalling.`);
    }
  }
} else {
  console.log("[auth-admin.ts] Firebase Admin SDK already initialized. Re-assigning authAdmin and dbAdmin.");
  if (admin.apps[0]) {
    authAdmin = admin.apps[0]!.auth();
    dbAdmin = admin.apps[0]!.firestore();
  }
}

// Final check and logging for status
if (admin.apps.length === 0) {
    console.error("[auth-admin.ts] CRITICAL: Firebase Admin SDK has NO initialized apps after attempt. Initialization failed.");
}
if (!authAdmin && admin.apps.length > 0) { // If apps exist but authAdmin is still null
    console.warn("[auth-admin.ts] Firebase Admin app initialized, but authAdmin instance is still null. Re-attempting assignment.");
    authAdmin = admin.auth(); // Attempt re-assignment
}
if (!dbAdmin && admin.apps.length > 0) { // If apps exist but dbAdmin is still null
    console.warn("[auth-admin.ts] Firebase Admin app initialized, but dbAdmin instance is still null. Re-attempting assignment.");
    dbAdmin = admin.firestore(); // Attempt re-assignment
}


if (!authAdmin) {
    console.error("[auth-admin.ts] FINAL CRITICAL: authAdmin (Firebase Admin Auth) is NULL. API routes requiring admin auth will fail.");
} else if (admin.apps.length > 0) {
    console.log("[auth-admin.ts] FINAL CHECK: authAdmin (Firebase Admin Auth) is INITIALIZED and available.");
}
if (!dbAdmin) {
    console.error("[auth-admin.ts] FINAL CRITICAL: dbAdmin (Firebase Admin Firestore) is NULL. API routes requiring admin Firestore access will fail.");
} else if (admin.apps.length > 0) {
    console.log("[auth-admin.ts] FINAL CHECK: dbAdmin (Firebase Admin Firestore) is INITIALIZED and available.");
}

export { authAdmin, dbAdmin };
