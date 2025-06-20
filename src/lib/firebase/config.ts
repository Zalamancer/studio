// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Standard Firebase initialization - check if any apps exist before initializing.
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

// Conditionally initialize storage and provide a clear error if not configured.
let storage;
if (firebaseConfig.storageBucket) {
  storage = getStorage(app);
} else {
  console.error("Firebase Storage Bucket is not configured. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment variables. Image upload features will be disabled.");
  storage = null;
}

export { app, auth, db, storage };
