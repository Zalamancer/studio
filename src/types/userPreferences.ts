// src/types/userPreferences.ts
export interface UserPreference {
  userId: string; // Corresponds to Firebase Auth UID
  favoriteSectorCodes?: string[]; // Keep as optional for backward compatibility if needed
  // Notification preferences
  notifyOnReply?: boolean;
  notifyOnMention?: boolean;
  notifyOnNewConnectionRequest?: boolean;
  notifyOnConnectionAccepted?: boolean;
  notifyOnNewMessage?: boolean;
  notifyOnPlatformUpdates?: boolean;
}

// For updating preferences
export type UpdateUserPreferencesData = Omit<Partial<UserPreference>, 'userId'>;
