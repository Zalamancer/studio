
// src/lib/firebase/auth-admin.ts
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

const SERVICE_ACCOUNT_LOG_PREFIX = "[auth-admin.ts]";
const serviceAccountKeyFileName = 'serviceAccountKey.json'; // Standard name

console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Module loaded. Attempting to initialize Firebase Admin SDK... NODE_ENV: ${process.env.NODE_ENV}`);

function initializeWithServiceAccount(keyPath: string, sourceDescription: string): boolean {
  try {
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting to initialize with service account key from ${sourceDescription} at: ${keyPath}`);
    if (fs.existsSync(keyPath)) {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Service account file FOUND at: ${keyPath}`);
      const serviceAccountJson = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialized successfully using service account key from ${sourceDescription}.`);
      return true;
    } else {
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Service account file NOT FOUND at: ${keyPath} (for ${sourceDescription}).`);
      return false;
    }
  } catch (error: any) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error initializing with service account key from ${sourceDescription} (${keyPath}):`, error.message);
    if (error.code === 'app/duplicate-app') {
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK was already initialized by another method.`);
      return true; // Consider it successful if already initialized
    }
    return false;
  }
}

if (!admin.apps.length) {
  let initialized = false;
  const gacEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (gacEnv) {
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS IS SET. Path: ${gacEnv}`);
    initialized = initializeWithServiceAccount(gacEnv, "GOOGLE_APPLICATION_CREDENTIALS env var");
  }

  if (!initialized && process.env.NODE_ENV === 'development') {
    console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS is NOT SET. In DEVELOPMENT mode, trying local paths.`);

    const devPathsToTry = [
      path.resolve(process.cwd(), serviceAccountKeyFileName), // Relative to current working directory
      path.resolve(process.cwd(), '..', serviceAccountKeyFileName), // One level up from cwd (if cwd is e.g. /functions)
      path.resolve(__dirname, '..', '..', '..', serviceAccountKeyFileName), // Relative to this file's location (e.g. src/lib/firebase -> root)
      path.resolve(serviceAccountKeyFileName) // Direct (less likely but for completeness)
    ];
    
    const uniqueDevPaths = [...new Set(devPathsToTry)]; // Remove duplicates

    for (const localKeyPath of uniqueDevPaths) {
      if (initialized) break;
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempt (dev): Checking for service account key at: ${localKeyPath}`);
      initialized = initializeWithServiceAccount(localKeyPath, `local path guess: ${localKeyPath}`);
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
        initialized = true; // Already initialized
      } else {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: ALL ATTEMPTS to initialize Firebase Admin SDK failed.`);
      }
    }
  }

  // Assign instances if any initialization succeeded OR if it was already initialized (duplicate app error)
  if (initialized || admin.apps.length > 0) {
    const appToUse = admin.apps.length > 0 ? admin.apps[0] : admin.app(); // admin.app() gets the default app if initializeApp was called without a name
    if (appToUse) {
        try {
            authAdminInstance = appToUse.auth();
            dbAdminInstance = appToUse.firestore();
            console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK instances assigned from app: ${appToUse.name}.`);
        } catch (instanceError: any) {
             console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error assigning instances from app ${appToUse.name}:`, instanceError.message);
        }
    } else {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} SDK claimed initialized/apps exist, but no app instance found.`);
    }
  }

} else {
  console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK already has ${admin.apps.length} initialized app(s). Using the first app.`);
  if (admin.apps.length > 0 && admin.apps[0]) {
      authAdminInstance = admin.apps[0]!.auth();
      dbAdminInstance = admin.apps[0]!.firestore();
  } else {
      console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} SDK already initialized, but no apps found in admin.apps array unexpectedly.`);
  }
}

// Final check and log for instance availability
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
