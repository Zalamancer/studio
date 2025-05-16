// src/types/userPreferences.ts
export interface UserPreference {
  userId: string; // Corresponds to Firebase Auth UID
  favoriteSectorCodes: string[];
}
