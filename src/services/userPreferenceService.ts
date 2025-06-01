
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

  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      const paymentMethodsRaw = data.paymentMethods;
      let parsedPaymentMethods: SavedPaymentMethod[] = [];
      if (Array.isArray(paymentMethodsRaw)) {
        parsedPaymentMethods = paymentMethodsRaw as SavedPaymentMethod[];
      } else if (paymentMethodsRaw) {
        console.warn(`[userPreferenceService] paymentMethods for user ${userId} is not an array. Will default to empty array.`);
      }

      const preferences: UserPreference = {
        userId: data.userId || userId,
        favoriteSectorCodes: Array.isArray(data.favoriteSectorCodes) ? data.favoriteSectorCodes : [],
        notifyOnReply: data.notifyOnReply ?? true,
        notifyOnMention: data.notifyOnMention ?? true,
        notifyOnNewConnectionRequest: data.notifyOnNewConnectionRequest ?? true,
        notifyOnConnectionAccepted: data.notifyOnConnectionAccepted ?? true,
        notifyOnNewMessage: data.notifyOnNewMessage ?? true,
        notifyOnPlatformUpdates: data.notifyOnPlatformUpdates ?? true,
        
        stripeCustomerId: data.stripeCustomerId || null,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        activeStripePriceId: data.activeStripePriceId || null,
        stripeSubscriptionStatus: data.stripeSubscriptionStatus || null,
        stripeSubscriptionCurrentPeriodEnd: data.stripeSubscriptionCurrentPeriodEnd || null,
        stripeSubscriptionWillCancelAtPeriodEnd: data.stripeSubscriptionWillCancelAtPeriodEnd || null,

        paymentMethods: parsedPaymentMethods,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
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
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        activeStripePriceId: null,
        stripeSubscriptionStatus: null,
        stripeSubscriptionCurrentPeriodEnd: null,
        stripeSubscriptionWillCancelAtPeriodEnd: null,
    };
  } catch (error: any) {
    console.error(`%c[userPreferenceService] getUserPreferences: Error fetching preferences for ${userId}:`, "color: red;", error);
    return null;
  }
};


export const updateUserPreferences = async (userId: string, dataToUpdate: UpdateUserPreferencesData): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required to update preferences.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new Error("Authentication error or user ID mismatch trying to update preferences.");
  }

  const prefDocRef = doc(db, PREFERENCES_COLLECTION, userId);
  try {
    const docSnap = await getDoc(prefDocRef);
    const updatePayload: Partial<UserPreference> & { updatedAt: Timestamp, userId: string } = {
      ...dataToUpdate,
      userId: userId, 
      updatedAt: Timestamp.now()
    };
    
    if (dataToUpdate.paymentMethods !== undefined) {
        updatePayload.paymentMethods = Array.isArray(dataToUpdate.paymentMethods) ? dataToUpdate.paymentMethods : [];
    }
    // Ensure subscription fields are explicitly set to null if undefined in dataToUpdate, to clear them
    if (dataToUpdate.stripeSubscriptionId === undefined) updatePayload.stripeSubscriptionId = null;
    if (dataToUpdate.activeStripePriceId === undefined) updatePayload.activeStripePriceId = null;
    if (dataToUpdate.stripeSubscriptionStatus === undefined) updatePayload.stripeSubscriptionStatus = null;
    if (dataToUpdate.stripeSubscriptionCurrentPeriodEnd === undefined) updatePayload.stripeSubscriptionCurrentPeriodEnd = null;
    if (dataToUpdate.stripeSubscriptionWillCancelAtPeriodEnd === undefined) updatePayload.stripeSubscriptionWillCancelAtPeriodEnd = null;


    if (docSnap.exists()) {
      await updateDoc(prefDocRef, updatePayload);
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
        stripeCustomerId: dataToUpdate.stripeCustomerId || null,
        stripeSubscriptionId: dataToUpdate.stripeSubscriptionId || null,
        activeStripePriceId: dataToUpdate.activeStripePriceId || null,
        stripeSubscriptionStatus: dataToUpdate.stripeSubscriptionStatus || null,
        stripeSubscriptionCurrentPeriodEnd: dataToUpdate.stripeSubscriptionCurrentPeriodEnd || null,
        stripeSubscriptionWillCancelAtPeriodEnd: dataToUpdate.stripeSubscriptionWillCancelAtPeriodEnd || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await setDoc(prefDocRef, createPayload);
    }
  } catch (error: any) {
    console.error(`%c[userPreferenceService] updateUserPreferences: Firestore error for user ${userId}:`, "color: red;", error);
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
  } catch (error: any) {
    console.error(`%c[userPreferenceService] addFavoriteSector: Firestore error for user ${userId}, sector ${sectorCode}:`, "color: red;", error);
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
    } else {
      console.log(`%c[userPreferenceService] removeFavoriteSector: No preferences doc found for user ${userId}. Nothing to remove.`, "color: orange;");
    }
  } catch (error: any) {
    console.error(`%c[userPreferenceService] removeFavoriteSector: Firestore error for user ${userId}, sector ${sectorCode}:`, "color: red;", error);
    throw new Error(error.message || "Could not remove favorite sector.");
  }
};
    