// src/services/userPreferenceService.ts
'use server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import type { UserPreference } from '@/types/userPreferences';

const PREFERENCES_COLLECTION = 'userPreferences';

export const getUserFavoriteSectors = async (userId: string): Promise<string[]> => {
  if (!userId) {
    console.log("getUserFavoriteSectors: No userId provided.");
    return [];
  }
  console.log(`getUserFavoriteSectors: Fetching for userId: ${userId}`);
  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UserPreference;
      console.log(`getUserFavoriteSectors: Preferences found for ${userId}:`, data.favoriteSectorCodes);
      return data.favoriteSectorCodes || [];
    }
    console.log(`getUserFavoriteSectors: No preferences document found for ${userId}.`);
    return [];
  } catch (error) {
    console.error(`getUserFavoriteSectors: Error fetching preferences for ${userId}:`, error);
    return []; // Return empty array on error to prevent UI crashes
  }
};

export const addFavoriteSector = async (userId: string, sectorCode: string): Promise<void> => {
  if (!userId || !sectorCode) {
    throw new Error("User ID and Sector Code are required.");
  }
  console.log(`addFavoriteSector: User ${userId} adding sector ${sectorCode}`);
  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      await updateDoc(prefDocRef, {
        favoriteSectorCodes: arrayUnion(sectorCode),
        updatedAt: Timestamp.now() // Optional: track updates
      });
      console.log(`addFavoriteSector: Sector ${sectorCode} added for user ${userId}.`);
    } else {
      await setDoc(prefDocRef, {
        userId,
        favoriteSectorCodes: [sectorCode],
        createdAt: Timestamp.now(), // Optional: track creation
        updatedAt: Timestamp.now()
      });
      console.log(`addFavoriteSector: Preferences doc created for user ${userId} with sector ${sectorCode}.`);
    }
  } catch (error: any) {
    console.error(`addFavoriteSector: Error for user ${userId}, sector ${sectorCode}:`, error);
    throw new Error(error.message || "Could not add favorite sector.");
  }
};

export const removeFavoriteSector = async (userId: string, sectorCode: string): Promise<void> => {
  if (!userId || !sectorCode) {
    throw new Error("User ID and Sector Code are required.");
  }
  console.log(`removeFavoriteSector: User ${userId} removing sector ${sectorCode}`);
  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      await updateDoc(prefDocRef, {
        favoriteSectorCodes: arrayRemove(sectorCode),
        updatedAt: Timestamp.now() // Optional: track updates
      });
      console.log(`removeFavoriteSector: Sector ${sectorCode} removed for user ${userId}.`);
    } else {
      console.log(`removeFavoriteSector: No preferences doc found for user ${userId}, nothing to remove.`);
    }
  } catch (error: any) {
    console.error(`removeFavoriteSector: Error for user ${userId}, sector ${sectorCode}:`, error);
    throw new Error(error.message || "Could not remove favorite sector.");
  }
};
