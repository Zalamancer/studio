
// src/lib/firebase/auth-admin.ts
import * as admin from 'firebase-admin';
import path from 'path'; // Import path for resolving file paths
import fs from 'fs'; // Import fs for checking file existence

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

const SERVICE_ACCOUNT_LOG_PREFIX = "[auth-admin.ts]";

console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Module loaded. Attempting to initialize Firebase Admin SDK... NODE_ENV: ${process.env.NODE_ENV}`);

if (!admin.apps.length) {
  try {
    const gacEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const serviceAccountKeyFileName = 'serviceAccountKey.json'; // Standard name

    if (gacEnv) {
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS environment variable IS SET. Path: ${gacEnv}`);
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting Firebase Admin SDK initialization using this environment variable...`);
      admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Uses GAC_ENV or ADC
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS environment variable IS NOT SET.`);
      const localKeyPath = path.resolve(process.cwd(), serviceAccountKeyFileName);
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Running in development mode. Attempting to load service account key from local path: ${localKeyPath}`);

      if (fs.existsSync(localKeyPath)) {
        // const serviceAccount = require(localKeyPath); // Using require can be problematic with bundlers/ESM
        const serviceAccountJson = fs.readFileSync(localKeyPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialized successfully using local service account key: ${localKeyPath}`);
      } else {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Local service account key NOT FOUND at: ${localKeyPath}. Firebase Admin SDK cannot initialize with a local key.`);
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Falling back to default initialization attempt, which may fail without GAC_ENV or a managed environment...`);
        admin.initializeApp(); // Attempt default, may fail
      }
    } else {
      // Not development and GAC_ENV not set
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} GOOGLE_APPLICATION_CREDENTIALS environment variable IS NOT SET and not in development mode.`);
      console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Default Firebase Admin SDK initialization will likely fail if not in a managed Google Cloud environment (e.g., Cloud Run, Cloud Functions with associated service account).`);
      console.log(`${SERVICE_ACCOUNT_LOG_PREFIX} Attempting default Firebase Admin SDK initialization...`);
      admin.initializeApp(); // Attempt default, may fail
    }

    authAdminInstance = admin.auth();
    dbAdminInstance = admin.firestore();
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialization sequence completed. Auth and DB instances assigned.`, "color: green; font-weight: bold;");

  } catch (error: any) {
    console.error(`%c${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK initialization error:`, "color: red; font-weight:bold;", error.message);
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Stack trace for initialization error:`, error.stack);
    if (error.code === 'app/duplicate-app') {
        console.warn(`${SERVICE_ACCOUNT_LOG_PREFIX} Firebase Admin SDK was already initialized (likely in another module or a hot-reload scenario). Using existing instance.`);
        if (admin.apps[0]) {
            authAdminInstance = admin.apps[0]!.auth();
            dbAdminInstance = admin.apps[0]!.firestore();
        }
    } else {
        console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} Initialization failed. For deployed environments, ensure GOOGLE_APPLICATION_CREDENTIALS is set. For local development, ensure '${serviceAccountKeyFileName}' is in your project root if GAC_ENV is not set.`);
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
} else if (admin.apps.length > 0 && admin.apps[0]) { // Added check for admin.apps[0]
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} authAdmin (Firebase Admin Auth) is INITIALIZED and available.`, "color: green;");
}

if (!dbAdminInstance) {
    console.error(`${SERVICE_ACCOUNT_LOG_PREFIX} CRITICAL: dbAdmin (Firebase Admin Firestore) is NULL. API routes requiring admin Firestore access will fail.`);
} else if (admin.apps.length > 0 && admin.apps[0]) { // Added check for admin.apps[0]
    console.log(`%c${SERVICE_ACCOUNT_LOG_PREFIX} dbAdmin (Firebase Admin Firestore) is INITIALIZED and available.`, "color: green;");
}

export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
