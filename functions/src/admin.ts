// functions/src/admin.ts

import * as admin from "firebase-admin";

// Initialize Admin SDK once here
admin.initializeApp();

export const db = admin.firestore();
export const auth = admin.auth();
