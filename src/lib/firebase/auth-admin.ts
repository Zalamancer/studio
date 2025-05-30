// src/lib/firebase/auth-admin.ts
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let authAdmin: admin.auth.Auth | null = null;
let dbAdmin: admin.firestore.Firestore | null = null;

const SERVICE_ACCOUNT_KEY_FILENAME = 'serviceAccountKey.json'; // Ensure this is at the project root

console.log("[auth-admin.ts] Module loaded. Attempting to initialize Firebase Admin SDK...");

if (!admin.apps.length) {
  try {
    console.log(`[auth-admin.ts] Attempting to initialize Firebase Admin SDK using local service account key file: ${SERVICE_ACCOUNT_KEY_FILENAME}`);
    const projectRoot = process.cwd();
    const keyPath = path.resolve(projectRoot, SERVICE_ACCOUNT_KEY_FILENAME);
    console.log(`[auth-admin.ts] Looking for service account key at absolute path: ${keyPath}`);

    if (fs.existsSync(keyPath)) {
      console.log(`[auth-admin.ts] Found service account key file: ${keyPath}`);
      const serviceAccountJSON = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountJSON);
      console.log("[auth-admin.ts] Service account JSON parsed successfully.");

      // Log critical fields from the parsed service account object for debugging
      console.log("%c[auth-admin.ts] DEBUG: Parsed Service Account Object (before cert):", "color: blue; font-weight:bold;", {
        hasProjectId: !!serviceAccount.project_id,
        projectIdType: typeof serviceAccount.project_id,
        projectIdValue: serviceAccount.project_id ? serviceAccount.project_id.substring(0, 20) + "..." : "MISSING",

        hasClientEmail: !!serviceAccount.client_email,
        clientEmailType: typeof serviceAccount.client_email,
        clientEmailValue: serviceAccount.client_email ? serviceAccount.client_email.substring(0, 30) + "..." : "MISSING",

        hasPrivateKey: !!serviceAccount.private_key,
        privateKeyType: typeof serviceAccount.private_key,
        privateKeySnippet: serviceAccount.private_key ? serviceAccount.private_key.substring(0, 30) + "..." : "MISSING",
        privateKeyEndsWithNewline: typeof serviceAccount.private_key === 'string' ? serviceAccount.private_key.endsWith('\\n') || serviceAccount.private_key.endsWith('\n') : "N/A",
      });

      if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        console.error("%c[auth-admin.ts] CRITICAL: Parsed service account JSON is missing one or more required fields (project_id, client_email, private_key).", "color: red; font-weight:bold;");
        throw new Error("Parsed service account JSON is missing required fields.");
      }
      
      // Ensure private_key newlines are actual newlines if they were escaped in JSON
      // This is usually not needed if JSON.parse handles \n correctly from the file.
      // But as a safeguard if the key was manually edited or came from .env logic previously.
      const processedPrivateKey = String(serviceAccount.private_key).replace(/\\n/g, '\n');

      const credentialObject = {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: processedPrivateKey,
      };
       console.log("%c[auth-admin.ts] DEBUG: Object being passed to admin.credential.cert():", "color: blue; font-weight:bold;", {
         projectId: credentialObject.projectId,
         clientEmail: credentialObject.clientEmail,
         privateKeySnippet: credentialObject.privateKey.substring(0,70) + "..."
       });


      admin.initializeApp({
        credential: admin.credential.cert(credentialObject),
      });

      authAdmin = admin.auth();
      dbAdmin = admin.firestore();
      console.log("%c[auth-admin.ts] Firebase Admin SDK initialized successfully using local key file.", "color: green; font-weight: bold;");

    } else {
      console.error(`%c[auth-admin.ts] CRITICAL: Service account key file NOT FOUND at path: ${keyPath}.`, "color: red; font-weight:bold;");
      console.error("[auth-admin.ts] Ensure 'serviceAccountKey.json' exists at the project root and is in .gitignore.");
    }
  } catch (error: any) {
    console.error("%c[auth-admin.ts] Firebase Admin SDK initialization error (using local key file):", "color: red; font-weight:bold;", error.message);
    console.error("[auth-admin.ts] Stack trace for initialization error:", error.stack);
    if (error.message && error.message.includes("Failed to parse private key")) {
      console.error("[auth-admin.ts] This 'Failed to parse private key' error usually means the private_key string within your serviceAccountKey.json is malformed or corrupted. Download a fresh key from Firebase.");
    } else if (error.message && error.message.includes("INTERNAL")) {
      console.error("[auth-admin.ts] The 'INTERNAL' error from firebase-admin often points to an issue with the firebase-admin package installation or its dependencies. Try deleting node_modules, package-lock.json, clearing npm cache, and reinstalling.");
    }
  }
} else {
  console.log("[auth-admin.ts] Firebase Admin SDK already initialized. Re-assigning authAdmin and dbAdmin.");
  if (admin.apps.length > 0 && admin.apps[0]) {
    authAdmin = admin.apps[0]!.auth();
    dbAdmin = admin.apps[0]!.firestore();
  }
}

if (!admin.apps.length && !authAdmin && !dbAdmin) {
    console.error("[auth-admin.ts] CRITICAL: Firebase Admin SDK has NO initialized apps after attempt. Initialization failed or was skipped.");
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
