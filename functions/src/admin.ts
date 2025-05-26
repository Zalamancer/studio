// functions/src/admin.ts

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

logger.info("admin.ts: Initializing Firebase Admin SDK...");

// Initialize Admin SDK once here
try {
  admin.initializeApp();
  logger.info("admin.ts: Firebase Admin SDK initialized successfully.");
} catch (error) {
  logger.error("admin.ts: Error initializing Firebase Admin SDK:", error);
}

export const db = admin.firestore();
export const auth = admin.auth();
logger.info("admin.ts: Firestore and Auth instances exported.");
