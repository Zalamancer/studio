// src/services/userPreferenceService.ts
// Client-side service, remove 'use server'; if it was there.

import { db, auth } from '@/lib/firebase/config'; // Import auth to check current user from client side
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import type { UserPreference } from '@/types/userPreferences';

const PREFERENCES_COLLECTION = 'userPreferences';

export const getUserFavoriteSectors = async (userId: string): Promise<string[]> => {
  if (!userId) {
    console.warn("[userPreferenceService] getUserFavoriteSectors: No userId provided.");
    return [];
  }
  console.log(`%c[userPreferenceService] getUserFavoriteSectors: Fetching for userId: ${userId}`, "color: dodgerblue;");
  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UserPreference;
      console.log(`%c[userPreferenceService] getUserFavoriteSectors: Preferences found for ${userId}:`, "color: green;", data.favoriteSectorCodes);
      return data.favoriteSectorCodes || [];
    }
    console.log(`%c[userPreferenceService] getUserFavoriteSectors: No preferences document found for ${userId}.`, "color: orange;");
    return [];
  } catch (error) {
    console.error(`%c[userPreferenceService] getUserFavoriteSectors: Error fetching preferences for ${userId}:`, "color: red;", error);
    return [];
  }
};

export const addFavoriteSector = async (userId: string, sectorCode: string): Promise<void> => {
  if (!userId || !sectorCode) {
    throw new Error("User ID and Sector Code are required.");
  }
  const currentUser = auth.currentUser;
  console.log(`%c[userPreferenceService] addFavoriteSector:
    Attempting to add sector.
    - userId param for doc path: ${userId}
    - auth.currentUser?.uid (client check): ${currentUser?.uid}
    - sectorCode: ${sectorCode}`, "color: blue; font-weight: bold;");

  if (!currentUser || currentUser.uid !== userId) {
    console.error(`%c[userPreferenceService] addFavoriteSector: CRITICAL - Auth mismatch or no auth user when service called.
      - userId param: ${userId}
      - auth.currentUser?.uid: ${currentUser?.uid}`, "color: red; font-weight: bold;");
    throw new Error("Authentication error or user ID mismatch trying to add favorite sector. Ensure you are logged in and the correct user ID is passed.");
  }

  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    const dataPayload = {
      userId, // Explicitly including userId in the document data
      favoriteSectorCodes: arrayUnion(sectorCode),
      updatedAt: Timestamp.now()
    };

    if (docSnap.exists()) {
      await updateDoc(prefDocRef, dataPayload);
      console.log(`%c[userPreferenceService] addFavoriteSector: Sector ${sectorCode} added for user ${userId}. (Updated existing doc)`, "color: green;");
    } else {
      await setDoc(prefDocRef, {
        ...dataPayload,
        createdAt: Timestamp.now()
      });
      console.log(`%c[userPreferenceService] addFavoriteSector: Preferences doc created for user ${userId} with sector ${sectorCode}.`, "color: green;");
    }
  } catch (error: any) {
    console.error(`%c[userPreferenceService] addFavoriteSector: Firestore error for user ${userId}, sector ${sectorCode}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Rules check 'request.auth.uid == userId'. Verify the document ID being written to matches the authenticated user's UID.");
    }
    throw new Error(error.message || "Could not add favorite sector.");
  }
};

export const removeFavoriteSector = async (userId: string, sectorCode: string): Promise<void> => {
  if (!userId || !sectorCode) {
    throw new Error("User ID and Sector Code are required.");
  }
  const currentUser = auth.currentUser;
  console.log(`%c[userPreferenceService] removeFavoriteSector:
    Attempting to remove sector.
    - userId param for doc path: ${userId}
    - auth.currentUser?.uid (client check): ${currentUser?.uid}
    - sectorCode: ${sectorCode}`, "color: blue; font-weight: bold;");

  if (!currentUser || currentUser.uid !== userId) {
     console.error(`%c[userPreferenceService] removeFavoriteSector: CRITICAL - Auth mismatch or no auth user when service called.
      - userId param: ${userId}
      - auth.currentUser?.uid: ${currentUser?.uid}`, "color: red; font-weight: bold;");
    throw new Error("Authentication error or user ID mismatch trying to remove favorite sector. Ensure you are logged in and the correct user ID is passed.");
  }

  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      await updateDoc(prefDocRef, {
        favoriteSectorCodes: arrayRemove(sectorCode),
        updatedAt: Timestamp.now()
      });
      console.log(`%c[userPreferenceService] removeFavoriteSector: Sector ${sectorCode} removed for user ${userId}.`, "color: green;");
    } else {
      console.log(`%c[userPreferenceService] removeFavoriteSector: No preferences doc found for user ${userId}, nothing to remove.`, "color: orange;");
    }
  } catch (error: any) {
    console.error(`%c[userPreferenceService] removeFavoriteSector: Firestore error for user ${userId}, sector ${sectorCode}:`, "color: red;", error);
     if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Rules check 'request.auth.uid == userId'. Verify the document ID being written to matches the authenticated user's UID.");
    }
    throw new Error(error.message || "Could not remove favorite sector.");
  }
};
