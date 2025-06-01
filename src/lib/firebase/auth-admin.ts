
// src/lib/firebase/auth-admin.ts
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

const SERVICE_ACCOUNT_LOG_PREFIX = "[auth-admin.ts]";
const serviceAccountKeyFileName = 'serviceAccountKey.json';

console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Module loaded. Attempting to initialize Firebase Admin SDK...`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Current Working Directory (process.cwd()): ${process.cwd()}`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} __dirname: ${__dirname}`);


function initializeWithServiceAccount(keyPathOrJsonContent: string, sourceDescription: string): boolean {
  try {
    let serviceAccount;
    const trimmedContent = keyPathOrJsonContent.trim();

    if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting to parse ${sourceDescription} as direct JSON content.`);
      serviceAccount = JSON.parse(trimmedContent);
    } else {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting to initialize with service account key from ${sourceDescription} at file path: ${keyPathOrJsonContent}`);
      if (fs.existsSync(keyPathOrJsonContent)) {
        console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Service account file FOUND at path: ${keyPathOrJsonContent}`);
        const serviceAccountJson = fs.readFileSync(keyPathOrJsonContent, 'utf8');
        serviceAccount = JSON.parse(serviceAccountJson);
      } else {
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Service account file NOT FOUND at path: ${keyPathOrJsonContent} (for ${sourceDescription}).`);
        return false;
      }
    }

    // Check if apps are already initialized to avoid "duplicate app" error
    if (admin.apps.length > 0) {
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK already initialized. Using existing app.`);
        const existingApp = admin.apps[0]; // Use the first initialized app
        if (existingApp) {
            authAdminInstance = existingApp.auth();
            dbAdminInstance = existingApp.firestore();
            return true;
        } else {
            // This case should ideally not happen if admin.apps.length > 0
            console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} admin.apps array is populated but contains no valid app.`);
            return false;
        }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialized successfully using service account from ${sourceDescription}.`);
    return true;

  } catch (error: any) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error initializing with service account from ${sourceDescription} ('${keyPathOrJsonContent.substring(0,100)}...'):`, error.message);
    if (error.code === 'app/duplicate-app') {
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK was already initialized by another method.`);
      // Attempt to get instances from the default app if it exists
      if (admin.apps.length > 0 && admin.apps[0]) {
        authAdminInstance = admin.apps[0].auth();
        dbAdminInstance = admin.apps[0].firestore();
        return true; // Consider it successful if already initialized and instances are retrieved
      }
    }
    return false;
  }
}

if (!admin.apps.length) {
  let initialized = false;
  const gacEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (gacEnv) {
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS IS SET.`);
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Value (first 100 chars): '${gacEnv.substring(0, 100)}...'`);
    initialized = initializeWithServiceAccount(gacEnv, "GOOGLE_APPLICATION_CREDENTIALS env var");
  }

  if (!initialized) {
    console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS is NOT SET or initialization failed. Trying local paths.`);
    const localKeyPath = path.resolve(process.cwd(), serviceAccountKeyFileName);
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempt (local): Checking for service account key at project root (resolved from process.cwd()): ${localKeyPath}`);
    initialized = initializeWithServiceAccount(localKeyPath, `local path guess (relative to cwd): ${localKeyPath}`);

    if (!initialized) {
        // Try path relative to this file's directory (__dirname) if the first local attempt fails
        // This is more complex due to build steps in Next.js but might catch some edge cases.
        // A common structure for compiled output in Next.js might place built files in .next/server/...
        // Let's try a few levels up from __dirname.
        const dirnamePathsToTry = [
            path.resolve(__dirname, '../../..', serviceAccountKeyFileName), // Common for src/lib/firebase -> .next/server/app/chunks -> root
            path.resolve(__dirname, '../../../..', serviceAccountKeyFileName), // Deeper nesting
        ];
        for (const dnPath of dirnamePathsToTry) {
            if(initialized) break;
            console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempt (local __dirname): Checking at: ${dnPath}`);
            initialized = initializeWithServiceAccount(dnPath, `local path guess (relative to __dirname): ${dnPath}`);
        }
    }
  }

  if (!initialized) {
    console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} No service account key found or initialization failed with key. Attempting default initialization (for managed environments like Cloud Run/Functions).`);
    try {
      admin.initializeApp();
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialized successfully using DEFAULT (managed environment) credentials.`);
      initialized = true;
    } catch (defaultInitError: any) {
      console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} DEFAULT Firebase Admin SDK initialization FAILED:`, defaultInitError.message);
      if (defaultInitError.code === 'app/duplicate-app') {
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Default init: Firebase Admin SDK was already initialized by another method.`);
        initialized = true;
      } else {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: ALL ATTEMPTS to initialize Firebase Admin SDK failed.`);
      }
    }
  }

  if (initialized || admin.apps.length > 0) {
    const appToUse = admin.app(); // Get the default app
    try {
        authAdminInstance = appToUse.auth();
        dbAdminInstance = appToUse.firestore();
        console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK instances (auth, db) assigned successfully from app: ${appToUse.name}.`);
    } catch (instanceError: any) {
         console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error assigning instances from app ${appToUse.name}:`, instanceError.message);
    }
  }

} else {
  console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK already has ${admin.apps.length} initialized app(s). Using the default app.`);
  const appToUse = admin.app(); // Get the default app
  try {
    authAdminInstance = appToUse.auth();
    dbAdminInstance = appToUse.firestore();
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK instances (auth, db) RE-ASSIGNED from already initialized app: ${appToUse.name}.`);
  } catch (instanceError: any) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error RE-ASSIGNING instances from existing app ${appToUse.name}:`, instanceError.message);
  }
}

if (authAdminInstance) {
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} authAdmin (Firebase Admin Auth) IS INITIALIZED and available.`, "color: green;");
} else {
    console.error(`%c${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: authAdmin (Firebase Admin Auth) IS NULL after all attempts. API routes requiring admin auth WILL FAIL.`, "color: red; font-weight: bold;");
}

if (dbAdminInstance) {
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} dbAdmin (Firebase Admin Firestore) IS INITIALIZED and available.`, "color: green;");
} else {
    console.error(`%c${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: dbAdmin (Firebase Admin Firestore) IS NULL after all attempts. API routes requiring admin Firestore WILL FAIL.`, "color: red; font-weight: bold;");
}

export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
    