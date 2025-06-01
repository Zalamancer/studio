
// src/services/userPreferenceService.ts
import { db, auth } from '@/lib/firebase/config'; // Import auth
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import type { UserPreference, UpdateUserPreferencesData, SavedPaymentMethod } from '@/types/userPreferences';

const PREFERENCES_COLLECTION = 'userPreferences';

export const getUserPreferences = async (userId: string): Promise<UserPreference | null> => {
  if (!userId) {
    console.warn("[userPreferenceService] getUserPreferences: No userId provided.");
    return null;
  }
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[userPreferenceService] getUserPreferences: Fetching for userId: '${userId}'. Current client auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  console.log(`%c[userPreferenceService] Rule Check Debug: For this call, rule will effectively check if '${clientAuthUid || 'NULL'}' == '${userId}'`, "color: #FF8C00; font-weight: bold;");

  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`%c[userPreferenceService] getUserPreferences: Raw data from Firestore for ${userId}:`, "color: green;", data);
      
      const paymentMethodsRaw = data.paymentMethods;
      let parsedPaymentMethods: SavedPaymentMethod[] = [];
      if (Array.isArray(paymentMethodsRaw)) {
        parsedPaymentMethods = paymentMethodsRaw as SavedPaymentMethod[];
      } else if (paymentMethodsRaw) {
        console.warn(`[userPreferenceService] paymentMethods for user ${userId} is not an array, but: ${typeof paymentMethodsRaw}. Will default to empty array. Data:`, paymentMethodsRaw);
      }
      console.log(`%c[userPreferenceService] getUserPreferences: Parsed paymentMethods for ${userId}:`, "color: green;", parsedPaymentMethods);

      const preferences: UserPreference = {
        userId: data.userId || userId, // Fallback to param userId if missing
        favoriteSectorCodes: Array.isArray(data.favoriteSectorCodes) ? data.favoriteSectorCodes : [],
        notifyOnReply: data.notifyOnReply ?? true,
        notifyOnMention: data.notifyOnMention ?? true,
        notifyOnNewConnectionRequest: data.notifyOnNewConnectionRequest ?? true,
        notifyOnConnectionAccepted: data.notifyOnConnectionAccepted ?? true,
        notifyOnNewMessage: data.notifyOnNewMessage ?? true,
        notifyOnPlatformUpdates: data.notifyOnPlatformUpdates ?? true,
        stripeCustomerId: data.stripeCustomerId || undefined,
        paymentMethods: parsedPaymentMethods,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
      console.log(`%c[userPreferenceService] getUserPreferences: Preferences object being returned for ${userId}:`, "color: green; font-weight:bold;", preferences);
      return preferences;
    }
    console.log(`%c[userPreferenceService] getUserPreferences: No preferences document found for ${userId}. Returning defaults.`, "color: orange;");
    return {
        userId: userId,
        favoriteSectorCodes: [],
        paymentMethods: [],
        notifyOnReply: true,
        notifyOnMention: true,
        notifyOnNewConnectionRequest: true,
        notifyOnConnectionAccepted: true,
        notifyOnNewMessage: true,
        notifyOnPlatformUpdates: true,
    };
  } catch (error: any) {
    console.error(`%c[userPreferenceService] getUserPreferences: Error fetching preferences for ${userId}:`, "color: red;", error);
    console.error(`%c  Auth state at error point: auth.currentUser?.uid = ${auth.currentUser?.uid || 'NULL'}`, "color: red;");
    return null;
  }
};


export const updateUserPreferences = async (userId: string, dataToUpdate: UpdateUserPreferencesData): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required to update preferences.");
  }
  const currentUser = auth.currentUser;
  console.log(`%c[userPreferenceService] updateUserPreferences:
    Attempting to update preferences.
    - userId param for doc path: ${userId}
    - auth.currentUser?.uid (client check): ${currentUser?.uid}`, "color: blue; font-weight: bold;");

  if (!currentUser || currentUser.uid !== userId) {
    console.error(`%c[userPreferenceService] updateUserPreferences: CRITICAL - Auth mismatch or no auth user.
      - userId param: ${userId}
      - auth.currentUser?.uid: ${currentUser?.uid}`, "color: red; font-weight: bold;");
    throw new Error("Authentication error or user ID mismatch trying to update preferences.");
  }

  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    const updatePayload: Partial<UserPreference> & { updatedAt: Timestamp, userId: string } = {
      ...dataToUpdate,
      userId: userId, // Explicitly ensure userId is part of the update for rules on create
      updatedAt: Timestamp.now()
    };
    
    // Ensure paymentMethods is an array, even if it's empty in dataToUpdate
    if (dataToUpdate.paymentMethods !== undefined) {
        updatePayload.paymentMethods = Array.isArray(dataToUpdate.paymentMethods) ? dataToUpdate.paymentMethods : [];
    }


    if (docSnap.exists()) {
      await updateDoc(prefDocRef, updatePayload);
      console.log(`%c[userPreferenceService] updateUserPreferences: Preferences updated for user ${userId}. Payload:`, "color: green;", updatePayload);
    } else {
      const createPayload: UserPreference = {
        userId: userId,
        favoriteSectorCodes: dataToUpdate.favoriteSectorCodes || [],
        paymentMethods: Array.isArray(dataToUpdate.paymentMethods) ? dataToUpdate.paymentMethods : [],
        notifyOnReply: dataToUpdate.notifyOnReply ?? true,
        notifyOnMention: dataToUpdate.notifyOnMention ?? true,
        notifyOnNewConnectionRequest: dataToUpdate.notifyOnNewConnectionRequest ?? true,
        notifyOnConnectionAccepted: dataToUpdate.notifyOnConnectionAccepted ?? true,
        notifyOnNewMessage: dataToUpdate.notifyOnNewMessage ?? true,
        notifyOnPlatformUpdates: dataToUpdate.notifyOnPlatformUpdates ?? true,
        stripeCustomerId: dataToUpdate.stripeCustomerId || undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await setDoc(prefDocRef, createPayload);
      console.log(`%c[userPreferenceService] updateUserPreferences: Preferences doc created for user ${userId}. Payload:`, "color: green;", createPayload);
    }
  } catch (error: any) {
    console.error(`%c[userPreferenceService] updateUserPreferences: Firestore error for user ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Rules check 'request.auth.uid == userId'.");
    }
    throw new Error(error.message || "Could not update user preferences.");
  }
};


export const getUserFavoriteSectors = async (userId: string): Promise<string[]> => {
  const preferences = await getUserPreferences(userId);
  return preferences?.favoriteSectorCodes || [];
};

export const addFavoriteSector = async (userId: string, sectorCode: string): Promise<void> => {
  if (!userId || !sectorCode) {
    throw new Error("User ID and Sector Code are required.");
  }
   const currentUser = auth.currentUser;
   if (!currentUser || currentUser.uid !== userId) {
     throw new Error("Authentication error or user ID mismatch.");
   }
  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    await setDoc(prefDocRef, {
      userId: userId, 
      favoriteSectorCodes: arrayUnion(sectorCode),
      updatedAt: Timestamp.now()
    }, { merge: true });
    console.log(`%c[userPreferenceService] addFavoriteSector: Sector ${sectorCode} added for user ${userId}.`, "color: green;");
  } catch (error: any) {
    console.error(`%c[userPreferenceService] addFavoriteSector: Firestore error for user ${userId}, sector ${sectorCode}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Rules check 'request.auth.uid == userId'.");
    }
    throw new Error(error.message || "Could not add favorite sector.");
  }
};

export const removeFavoriteSector = async (userId: string, sectorCode: string): Promise<void> => {
  if (!userId || !sectorCode) {
    throw new Error("User ID and Sector Code are required.");
  }
   const currentUser = auth.currentUser;
   if (!currentUser || currentUser.uid !== userId) {
     throw new Error("Authentication error or user ID mismatch.");
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
      console.log(`%c[userPreferenceService] removeFavoriteSector: No preferences doc found for user ${userId}. Nothing to remove.`, "color: orange;");
    }
  } catch (error: any) {
    console.error(`%c[userPreferenceService] removeFavoriteSector: Firestore error for user ${userId}, sector ${sectorCode}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Rules check 'request.auth.uid == userId'.");
    }
    throw new Error(error.message || "Could not remove favorite sector.");
  }
};
    
    