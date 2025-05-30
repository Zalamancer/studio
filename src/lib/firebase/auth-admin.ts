// src/lib/firebase/auth-admin.ts
import * as admin from 'firebase-admin';

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

const SERVICE_ACCOUNT_LOG_PREFIX = "[auth-admin.ts]";

console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Module loaded. Attempting to initialize Firebase Admin SDK...`);

if (!admin.apps.length) {
  try {
    const gacEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (gacEnv) {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS environment variable IS SET. Path: ${gacEnv}`);
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting default Firebase Admin SDK initialization...`);
    } else {
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS environment variable IS NOT SET.`);
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Default Firebase Admin SDK initialization might fail if not in a managed Google Cloud environment (e.g., Cloud Run, Cloud Functions with associated service account).`);
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting default Firebase Admin SDK initialization anyway...`);
    }

    admin.initializeApp(); // Relies on GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials

    authAdminInstance = admin.auth();
    dbAdminInstance = admin.firestore();
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialized successfully using Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or managed environment).`, "color: green; font-weight: bold;");
  } catch (error: any) {
    console.error(`%c${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK default initialization error:`, "color: red; font-weight:bold;", error.message);
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Stack trace for initialization error:`, error.stack);
    if (error.code === 'app/duplicate-app') {
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK was already initialized (likely in another module or a hot-reload scenario). Using existing instance.`);
        if (admin.apps[0]) {
            authAdminInstance = admin.apps[0]!.auth();
            dbAdminInstance = admin.apps[0]!.firestore();
        }
    } else {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Ensure GOOGLE_APPLICATION_CREDENTIALS environment variable is correctly set to the path of your service account JSON key file, or that the runtime environment (e.g., Cloud Run) has an associated service account with necessary permissions.`);
    }
  }
} else {
  console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK already has ${admin.apps.length} initialized app(s). Re-assigning authAdmin and dbAdmin from the first app.`);
  if (admin.apps[0]) {
    authAdminInstance = admin.apps[0]!.auth();
    dbAdminInstance = admin.apps[0]!.firestore();
  } else {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} SDK already initialized, but no apps found in admin.apps array unexpectedly.`);
  }
}

if (!admin.apps.length && !authAdminInstance && !dbAdminInstance) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: Firebase Admin SDK has NO initialized apps after attempt. Initialization failed or was skipped.`);
}

if (!authAdminInstance) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: authAdmin (Firebase Admin Auth) is NULL. API routes requiring admin auth will fail.`);
} else if (admin.apps.length > 0) {
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} authAdmin (Firebase Admin Auth) is INITIALIZED and available.`, "color: green;");
}

if (!dbAdminInstance) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: dbAdmin (Firebase Admin Firestore) is NULL. API routes requiring admin Firestore access will fail.`);
} else if (admin.apps.length > 0) {
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} dbAdmin (Firebase Admin Firestore) is INITIALIZED and available.`, "color: green;");
}

export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
