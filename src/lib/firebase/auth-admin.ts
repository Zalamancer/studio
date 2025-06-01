
// src/lib/firebase/auth-admin.ts
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

const ADMIN_APP_NAME = 'firebase-admin-app-anonycollab'; // Unique name for the admin app
const SERVICE_ACCOUNT_LOG_PREFIX = "[auth-admin.ts]";
const serviceAccountKeyFileName = 'serviceAccountKey.json';

console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Module loaded. Attempting to initialize Firebase Admin SDK with app name: ${ADMIN_APP_NAME}...`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Current Working Directory (process.cwd()): ${process.cwd()}`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} DEBUG: typeof admin.firestore is: ${typeof admin.firestore}`);
console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} DEBUG: typeof admin.firestore.FieldValue is: ${typeof admin.firestore.FieldValue}`);


function getAdminApp(): admin.app.App | null {
  try {
    // Attempt to get the app by its unique name
    const app = admin.apps.find(app => app?.name === ADMIN_APP_NAME);
    if (app) {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} getAdminApp: Found existing app by name '${ADMIN_APP_NAME}'.`);
      return app;
    }
    // Fallback for environments where named apps might behave differently or if it's the default app
    if (admin.apps.length > 0) {
        console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} getAdminApp: No app found by name '${ADMIN_APP_NAME}', but admin.apps has ${admin.apps.length} app(s). Returning admin.apps[0].`);
        return admin.apps[0]; // Could be [DEFAULT] or another named app
    }
    return null; // No apps exist
  } catch (e: any) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} getAdminApp: Error checking for app '${ADMIN_APP_NAME}': ${e.message}`);
    return null; // App doesn't exist or error occurred
  }
}

function initializeAdminAppWithCredentials(credential: admin.credential.Credential, sourceDescription: string): boolean {
  try {
    if (!getAdminApp()) { // Only initialize if no app (by name or default) exists
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Initializing NEW Firebase ADMIN App '${ADMIN_APP_NAME}' using ${sourceDescription}.`);
      admin.initializeApp({
        credential,
      }, ADMIN_APP_NAME);
    } else {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase ADMIN App '${ADMIN_APP_NAME}' (or a default) already exists. Using existing instance for credentials check logic, but new services will be from the named app if created.`);
    }
    return true;
  } catch (error: any) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error initializing ADMIN App '${ADMIN_APP_NAME}' with ${sourceDescription}:`, error.message);
    return false;
  }
}

if (!getAdminApp()) {
  let initialized = false;
  const gacEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (gacEnv) {
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS IS SET.`);
    let serviceAccountContent;
    try {
      if (gacEnv.trim().startsWith('{')) {
        serviceAccountContent = JSON.parse(gacEnv);
        console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Parsed GOOGLE_APPLICATION_CREDENTIALS as JSON content.`);
      } else if (fs.existsSync(gacEnv)) {
        console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Reading GOOGLE_APPLICATION_CREDENTIALS from file path: ${gacEnv}`);
        const serviceAccountJson = fs.readFileSync(gacEnv, 'utf8');
        serviceAccountContent = JSON.parse(serviceAccountJson);
      } else {
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS path does not exist: ${gacEnv}`);
      }

      if (serviceAccountContent) {
        initialized = initializeAdminAppWithCredentials(admin.credential.cert(serviceAccountContent), "GOOGLE_APPLICATION_CREDENTIALS env var");
      }
    } catch (e: any) {
      console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error processing GOOGLE_APPLICATION_CREDENTIALS: ${e.message}`);
    }
  }

  if (!initialized) {
    console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS not set or failed. Trying local file.`);
    const localKeyPath = path.resolve(process.cwd(), serviceAccountKeyFileName);
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting local service account key: ${localKeyPath}`);
    if (fs.existsSync(localKeyPath)) {
      try {
        const serviceAccountJson = fs.readFileSync(localKeyPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        initialized = initializeAdminAppWithCredentials(admin.credential.cert(serviceAccount), `local file: ${localKeyPath}`);
      } catch (e: any) {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error processing local service account file ${localKeyPath}: ${e.message}`);
      }
    } else {
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Local service account file NOT FOUND at: ${localKeyPath}`);
    }
  }

  if (!initialized) {
    console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Service account key not found or failed. Attempting default initialization (for managed environments like Cloud Run/Functions).`);
    try {
      if (!getAdminApp()) { 
         console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Initializing Firebase ADMIN App with DEFAULT credentials and specific name '${ADMIN_APP_NAME}'.`);
         admin.initializeApp(undefined, ADMIN_APP_NAME); 
         initialized = true;
      } else {
         console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase ADMIN App was found just before default init attempt. Assuming already initialized.`);
         initialized = true;
      }
    } catch (defaultInitError: any) {
      console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} DEFAULT Firebase ADMIN App '${ADMIN_APP_NAME}' initialization FAILED:`, defaultInitError.message);
    }
  }
} else {
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase ADMIN App already initialized or detected by getAdminApp().`);
}

const adminAppInstance = getAdminApp(); // Get the app (either newly initialized by name or existing)

if (adminAppInstance) {
  console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Retrieved adminAppInstance. Name: ${adminAppInstance.name}. Attempting to get auth() and firestore().`);
  try {
    authAdminInstance = adminAppInstance.auth();
    dbAdminInstance = adminAppInstance.firestore();
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Auth and DB instances obtained from ADMIN App '${adminAppInstance.name}'.`);
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} typeof dbAdminInstance.collection: ${typeof dbAdminInstance?.collection}`);
    console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} dbAdminInstance constructor name: ${dbAdminInstance?.constructor?.name}`);
  } catch (e: any) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Error getting auth/db from ADMIN App '${adminAppInstance.name}': ${e.message}`);
  }
} else {
  console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: Firebase ADMIN App instance NOT available after all initialization attempts.`);
}

if (authAdminInstance) {
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} authAdmin (Firebase Admin Auth from '${adminAppInstance?.name || 'UNKNOWN_APP'}') IS INITIALIZED and available.`, "color: green;");
} else {
    console.error(`%c${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: authAdmin (Firebase Admin Auth from '${adminAppInstance?.name || 'UNKNOWN_APP'}') IS NULL. API routes requiring admin auth WILL FAIL.`, "color: red; font-weight: bold;");
}

if (dbAdminInstance) {
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} dbAdmin (Firebase Admin Firestore from '${adminAppInstance?.name || 'UNKNOWN_APP'}') IS INITIALIZED and available.`, "color: green;");
} else {
    console.error(`%c${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: dbAdmin (Firebase Admin Firestore from '${adminAppInstance?.name || 'UNKNOWN_APP'}') IS NULL. API routes requiring admin Firestore WILL FAIL.`, "color: red; font-weight: bold;");
}

export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
    